import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bookId = formData.get('bookId') as string;
    const importMode = (formData.get('mode') as string) || 'ai';

    if (!file || !bookId) {
      return NextResponse.json({ error: 'Missing file or bookId' }, { status: 400 });
    }

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedExts = ['txt', 'docx', 'pdf'];
    if (!ext || !allowedExts.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use .txt, .docx, or .pdf' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Step 1: Extract text from file
    let extractedText = '';

    if (ext === 'txt') {
      extractedText = buffer.toString('utf-8');
    } else if (ext === 'docx') {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } catch (err) {
        console.error('DOCX parse error:', err);
        return NextResponse.json({ 
          error: 'Failed to parse DOCX file. Try saving it as .txt and importing again.',
          details: err instanceof Error ? err.message : String(err)
        }, { status: 400 });
      }
    } else if (ext === 'pdf') {
      // Basic PDF text extraction
      const textParts: string[] = [];
      const str = buffer.toString('latin1');
      const btRegex = /\(([^)]+)\)/g;
      let match;
      while ((match = btRegex.exec(str)) !== null) {
        const text = match[1];
        if (text.length > 2 && /^[\x20-\x7E\xC0-\xFF]+$/.test(text)) {
          textParts.push(text);
        }
      }
      extractedText = textParts.length > 10 ? textParts.join(' ') : '';
      if (!extractedText) {
        return NextResponse.json({ 
          error: 'Could not extract text from PDF. PDF parsing is limited. Try exporting the PDF as .txt or .docx first and import that instead.' 
        }, { status: 400 });
      }
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: 'Could not extract any text from the file. The file may be empty or corrupted.' }, { status: 400 });
    }

    // Step 2: AI import mode
    if (importMode === 'ai') {
      const aiConfig = await db.aiConfig.findFirst({ where: { isActive: true } });
      if (!aiConfig) {
        return NextResponse.json({ 
          error: 'No AI provider configured. Go to Settings to add an AI provider first, or use "Raw Import" mode to import text directly.',
          hint: 'raw_mode'
        }, { status: 400 });
      }

      try {
        const { callAIForImport } = await import('@/lib/ai-import');
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

        const aiResult = await callAIForImport(aiConfig, systemPrompt, extractedText);

        if (!aiResult) {
          return NextResponse.json({ error: 'AI could not parse the document. The AI response was not valid JSON. Try again with a shorter document, or use Raw Import mode.' }, { status: 500 });
        }

        // Create database records
        const created = { codex: 0, chapters: 0, scenes: 0 };

        if (aiResult.codex && Array.isArray(aiResult.codex)) {
          for (const entry of aiResult.codex) {
            if (entry.name && entry.type) {
              try {
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
              } catch (err) {
                console.error('Failed to create codex entry:', entry.name, err);
              }
            }
          }
        }

        const chapters = aiResult.manuscript?.length ? aiResult.manuscript : aiResult.outline;
        if (chapters && Array.isArray(chapters)) {
          for (let i = 0; i < chapters.length; i++) {
            const ch = chapters[i];
            try {
              const chapter = await db.chapter.create({
                data: {
                  bookId,
                  title: (ch.chapterTitle || `Chapter ${i + 1}`).slice(0, 200),
                  synopsis: (ch.synopsis || '').slice(0, 2000) || null,
                  sortOrder: i,
                },
              });
              created.chapters++;

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
            } catch (err) {
              console.error('Failed to create chapter/scene:', err);
            }
          }
        }

        return NextResponse.json({
          success: true,
          message: `Imported: ${created.codex} codex entries, ${created.chapters} chapters, ${created.scenes} scenes`,
          created,
        });
      } catch (err) {
        console.error('AI import error:', err);
        return NextResponse.json({ 
          error: 'AI import failed: ' + (err instanceof Error ? err.message : String(err)) + '. Try Raw Import mode instead.'
        }, { status: 500 });
      }
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
