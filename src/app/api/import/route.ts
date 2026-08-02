import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { readFile } from 'fs/promises';
import mammoth from 'mammoth';

export async function POST(req: NextRequest) {
  try {
    const auth = verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bookId = formData.get('bookId') as string;
    const importMode = (formData.get('mode') as string) || 'ai'; // 'ai' or 'raw'

    if (!file || !bookId) {
      return NextResponse.json({ error: 'Missing file or bookId' }, { status: 400 });
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt')) {
      return NextResponse.json({ error: 'Unsupported file type. Use .pdf, .docx, or .txt' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Step 1: Extract text from file
    let extractedText = '';

    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } else if (file.name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (file.type === 'application/pdf') {
      // For PDF, extract text (basic approach - no external PDF text parser needed)
      // We'll use a simple text extraction or pass raw to AI
      extractedText = `[PDF content extracted - ${buffer.length} bytes]`;
      // Try to extract readable text strings from the PDF buffer
      const textParts: string[] = [];
      const str = buffer.toString('latin1');
      // Extract text between BT and ET markers (basic PDF text extraction)
      const btRegex = /\(([^)]+)\)/g;
      let match;
      while ((match = btRegex.exec(str)) !== null) {
        const text = match[1];
        if (text.length > 2 && /^[\x20-\x7E\xC0-\xFF]+$/.test(text)) {
          textParts.push(text);
        }
      }
      if (textParts.length > 10) {
        extractedText = textParts.join(' ');
      }
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 });
    }

    // Step 2: Use AI to parse the document and create structured data
    if (importMode === 'ai') {
      // Get active AI config
      const aiConfig = await db.aiConfig.findFirst({ where: { isActive: true } });
      if (!aiConfig) {
        return NextResponse.json({ error: 'No AI provider configured. Set one up in Settings first.' }, { status: 400 });
      }

      // Build the AI prompt
      const systemPrompt = `You are a creative writing assistant. Analyze the following document and extract structured information for a novel writing app.

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "codex": [
    {"type": "character", "name": "Name", "description": "Detailed description including personality, appearance, background"},
    {"type": "location", "name": "Name", "description": "Description of the location"},
    {"type": "lore", "name": "Name", "description": "World-building rules, magic systems, history"},
    {"type": "item", "name": "Name", "description": "Important objects, weapons, artifacts"},
    {"type": "subplot", "name": "Name", "description": "Subplot description"},
    {"type": "theme", "name": "Name", "description": "Thematic elements"}
  ],
  "outline": [
    {"chapterTitle": "Chapter Title", "synopsis": "Brief synopsis"}
  ],
  "manuscript": [
    {"chapterTitle": "Title", "scenes": [{"title": "Scene Title", "content": "The actual prose text..."}]}
  ]
}

Rules:
- If you find character information, create character entries with full descriptions
- If you find location descriptions, create location entries
- Organize manuscript content into chapters and scenes
- If no clear chapter structure exists, create reasonable divisions
- Keep scene content as close to the original text as possible
- If the document is just a list/outline (not prose), put everything in "outline" and leave "manuscript" empty
- If it's pure prose with no structure, create a single chapter with the full text`;

      const { callAIForImport } = await import('@/lib/ai-import');
      const aiResult = await callAIForImport(aiConfig, systemPrompt, extractedText);

      if (!aiResult) {
        return NextResponse.json({ error: 'AI failed to parse the document. Try again or use raw import.' }, { status: 500 });
      }

      // Step 3: Create database records from AI result
      const created = { codex: 0, chapters: 0, scenes: 0 };

      // Create codex entries
      if (aiResult.codex && Array.isArray(aiResult.codex)) {
        for (const entry of aiResult.codex) {
          if (entry.name && entry.type) {
            await db.codexEntry.create({
              data: {
                bookId,
                type: entry.type,
                name: entry.name.slice(0, 200),
                description: (entry.description || '').slice(0, 5000),
                aliases: '[]',
                tags: '[]',
                metadata: '{}',
              },
            });
            created.codex++;
          }
        }
      }

      // Create outline / manuscript chapters
      const chapters = aiResult.manuscript?.length ? aiResult.manuscript : aiResult.outline;
      if (chapters && Array.isArray(chapters)) {
        for (let i = 0; i < chapters.length; i++) {
          const ch = chapters[i];
          const chapter = await db.chapter.create({
            data: {
              bookId,
              title: (ch.chapterTitle || `Chapter ${i + 1}`).slice(0, 200),
              synopsis: (ch.synopsis || '').slice(0, 2000) || null,
              sortOrder: i,
            },
          });
          created.chapters++;

          // Create scenes if manuscript data
          if (ch.scenes && Array.isArray(ch.scenes)) {
            for (let j = 0; j < ch.scenes.length; j++) {
              const sc = ch.scenes[j];
              const content = typeof sc.content === 'string' ? sc.content : JSON.stringify(sc.content);
              const wordCount = content.split(/\s+/).filter(Boolean).length;
              await db.scene.create({
                data: {
                  chapterId: chapter.id,
                  title: (sc.title || `Scene ${j + 1}`).slice(0, 200),
                  content,
                  wordCount,
                  sortOrder: j,
                },
              });
              created.scenes++;
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Imported: ${created.codex} codex entries, ${created.chapters} chapters, ${created.scenes} scenes`,
        created,
      });
    }

    // Raw mode: import as a single chapter
    const chapter = await db.chapter.create({
      data: {
        bookId,
        title: file.name.replace(/\.[^.]+$/, ''),
        sortOrder: 999,
      },
    });
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
    await db.scene.create({
      data: {
        chapterId: chapter.id,
        title: 'Imported Content',
        content: extractedText,
        wordCount,
        sortOrder: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Imported as raw text into a new chapter',
      created: { codex: 0, chapters: 1, scenes: 1 },
    });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Import failed: ' + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
