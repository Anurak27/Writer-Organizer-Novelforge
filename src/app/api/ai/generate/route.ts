import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { safeJsonParse } from '@/lib/utils';
import { callAI } from '@/lib/ai-provider';

export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, text, sceneContent, mentionedNames, beats, bookId, sceneId } = await request.json();

    const config = await db.aiConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return NextResponse.json({ error: 'No AI provider configured. Go to Settings to add your API key.' }, { status: 400 });
    }

    // 1. Gather codex context from @mentions
    let codexContext = '';
    if (mentionedNames && mentionedNames.length > 0) {
      const entries = await db.codexEntry.findMany({
        where: {
          OR: [
            ...(bookId ? [{ bookId }] : []),
            { bookId: null },
          ],
        },
      });

      const mentioned = entries.filter((e) => {
        const aliases = safeJsonParse<string[]>(e.aliases, [], true);
        const allNames = [e.name, ...aliases].map((n) => n.toLowerCase());
        return mentionedNames.some((mn: string) => allNames.includes(mn.toLowerCase()));
      });

      if (mentioned.length > 0) {
        codexContext = mentioned
          .map((e) => `[${e.type.toUpperCase()}] ${e.name}: ${e.description}`)
          .join('\n');
      }
    }

    // 2. Gather pinned codex entries for this scene (FIXED: use safeJsonParse)
    if (sceneId) {
      const scene = await db.scene.findUnique({ where: { id: sceneId } });
      if (scene) {
        const pinnedIds = safeJsonParse<string[]>(scene.pinnedCodexIds, [], false);
        if (pinnedIds.length > 0) {
          const pinned = await db.codexEntry.findMany({
            where: { id: { in: pinnedIds } },
          });
          if (pinned.length > 0) {
            const pinnedContext = pinned
              .map((e) => `[${e.type.toUpperCase()}] ${e.name}: ${e.description}`)
              .join('\n');
            codexContext = codexContext
              ? `${codexContext}\n\nPinned context entries for this scene:\n${pinnedContext}`
              : `Pinned context entries for this scene:\n${pinnedContext}`;
          }
        }
      }
    }

    // 3. Fetch book metadata for POV and style emulation
    let bookMeta: { pov?: string; povTense?: string; customPrompt?: string | null; language?: string; penName?: string | null } = {};
    let chapterTextForStyle = '';
    if (bookId) {
      const book = await db.book.findUnique({ where: { id: bookId } });
      if (book) {
        bookMeta = {
          pov: book.pov,
          povTense: book.povTense,
          customPrompt: book.customPrompt,
          language: book.language,
          penName: book.penName,
        };

        // Style emulation: grab text from other scenes in the same chapter
        if (sceneId) {
          const currentScene = await db.scene.findUnique({ where: { id: sceneId } });
          if (currentScene) {
            const siblingScenes = await db.scene.findMany({
              where: {
                chapterId: currentScene.chapterId,
                id: { not: sceneId },
              },
              orderBy: { sortOrder: 'asc' },
              take: 3,
            });
            for (const s of siblingScenes.reverse()) {
              if (s.content && s.content.trim().length > 100) {
                chapterTextForStyle = s.content.slice(-1500);
                break;
              }
            }
          }
        }
      }
    }

    const systemPrompt = buildSystemPrompt(
      action,
      sceneContent,
      codexContext,
      bookMeta,
      chapterTextForStyle,
    );

    let userMessage = '';
    if (action === 'expand') {
      userMessage = `Expand the following passage with more detail, sensory description, and emotional depth while maintaining the author's voice and style:\n\n${text}`;
    } else if (action === 'rewrite') {
      userMessage = `Rewrite the following passage to improve flow, clarity, and prose quality while preserving the original meaning and events:\n\n${text}`;
    } else if (action === 'shorten') {
      userMessage = `Condense the following passage to be more concise while preserving key plot points, character actions, and emotional beats:\n\n${text}`;
    } else if (action === 'continue') {
      userMessage = `Continue writing from the following text. Pick up exactly where it leaves off — do not repeat any of the existing text. Maintain the same voice, tone, and pacing:\n\n${sceneContent || text}`;
    } else if (action === 'summarize') {
      userMessage = `Write a concise 2-3 sentence summary of this scene:\n\n${sceneContent || text}`;
    } else if (action === 'generate_scene' && beats) {
      userMessage = `Write a rough draft scene based on these beats:\n${beats}\n\nWrite it in prose form, with dialogue, action, and sensory details. Use a literary fiction style.`;
    } else {
      userMessage = text || '';
    }

    const result = await callAI(
      config.provider,
      config.apiKey,
      config.baseUrl,
      config.modelName,
      systemPrompt,
      userMessage
    );

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI generation failed';
    console.error('[AI Generate Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildSystemPrompt(
  action: string,
  sceneContent: string,
  codexContext: string,
  bookMeta: { pov?: string; povTense?: string; customPrompt?: string | null; language?: string; penName?: string | null },
  styleSample: string,
): string {
  if (bookMeta.customPrompt && (action === 'expand' || action === 'rewrite' || action === 'continue' || action === 'generate_scene')) {
    let custom = bookMeta.customPrompt;
    if (codexContext) {
      custom += `\n\nHere is relevant context from the author's Story Bible (Codex):\n${codexContext}`;
    }
    return custom;
  }

  let prompt = 'You are a skilled creative writing assistant helping a novelist.';

  if (bookMeta.pov) {
    const povMap: Record<string, string> = {
      first_past: 'first person past tense ("I went")',
      first_present: 'first person present tense ("I go")',
      second_past: 'second person past tense ("You went")',
      second_present: 'second person present tense ("You go")',
      third_past: 'third person past tense ("She went")',
      third_present: 'third person present tense ("She goes")',
      third_omniscient: 'third person omniscient past tense',
    };
    const povDesc = povMap[bookMeta.pov] || bookMeta.pov;
    prompt += `\n\nPOV: Write in ${povDesc}. This is critical — maintain this point of view consistently.`;
  }

  if (styleSample && styleSample.length > 100) {
    prompt += `\n\nSTYLE REFERENCE: Study the following writing sample and emulate its voice, sentence structure, vocabulary level, and prose rhythm:\n---\n${styleSample}\n---`;
  }

  if (bookMeta.penName) {
    prompt += `\n\nThe author's pen name is ${bookMeta.penName}.`;
  }

  if (codexContext) {
    prompt += `\n\nHere is relevant context from the author's Story Bible (Codex):\n${codexContext}`;
  }

  if (sceneContent && (action === 'generate_scene' || action === 'continue')) {
    prompt += `\n\nCurrent scene context (what has been written so far in this scene):\n${sceneContent.slice(-2000)}`;
  }

  if (action === 'summarize') {
    prompt += '\n\nWrite a concise 2-3 sentence summary. Do not include meta-commentary.';
  } else {
    prompt += '\n\nRespond only with the prose text. Do not include meta-commentary, explanations, or markdown code blocks. Write in a way that seamlessly continues or modifies the existing text.';
  }

  return prompt;
}
