import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { safeJsonParse } from '@/lib/utils';
import { callAIWithHistory } from '@/lib/ai-provider';

export async function GET(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('bookId');

    const where: Record<string, unknown> = {};
    if (bookId) {
      where.bookId = bookId;
    } else {
      where.bookId = null;
    }

    const messages = await db.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, content, bookId, mentionedNames } = body;

    // --- Clear action ---
    if (action === 'clear') {
      if (!bookId) {
        return NextResponse.json({ error: 'bookId is required for clear action' }, { status: 400 });
      }

      await db.chatMessage.deleteMany({
        where: { bookId },
      });

      return NextResponse.json({ success: true });
    }

    // --- Send action ---
    if (action === 'send') {
      if (!content?.trim()) {
        return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
      }

      // Save user message
      const userMessage = await db.chatMessage.create({
        data: {
          role: 'user',
          content: content.trim(),
          bookId: bookId || null,
        },
      });

      // Get AI config
      const config = await db.aiConfig.findFirst({ where: { isActive: true } });
      if (!config) {
        return NextResponse.json(
          { error: 'No AI provider configured. Go to Settings to add your API key.' },
          { status: 400 },
        );
      }

      // Build book outline context
      let outlineContext = '';
      if (bookId) {
        const chapters = await db.chapter.findMany({
          where: { bookId },
          orderBy: { sortOrder: 'asc' },
          include: {
            scenes: {
              orderBy: { sortOrder: 'asc' },
              select: { title: true },
            },
          },
        });

        if (chapters.length > 0) {
          const lines = chapters.map((ch) => {
            const sceneTitles = ch.scenes.map((s) => `    - ${s.title}`).join('\n');
            return `  Chapter: ${ch.title}${sceneTitles ? '\n' + sceneTitles : ''}`;
          });
          outlineContext = `\n\nThe author is working on a book with this outline:\n${lines.join('\n')}`;
        }
      }

      // Build codex context from mentioned names
      let codexContext = '';
      if (mentionedNames && mentionedNames.length > 0) {
        const entries = await db.codexEntry.findMany({
          where: {
            OR: [...(bookId ? [{ bookId }] : []), { bookId: null }],
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

      // Fetch conversation history
      const historyWhere: Record<string, unknown> = {};
      if (bookId) {
        historyWhere.bookId = bookId;
      } else {
        historyWhere.bookId = null;
      }

      const history = await db.chatMessage.findMany({
        where: historyWhere,
        orderBy: { createdAt: 'asc' },
      });

      const conversationMessages = history
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      let systemPrompt =
        'You are a creative writing sparring partner helping a novelist brainstorm ideas, fix plot holes, develop characters, and explore story directions. Be conversational, insightful, and ask follow-up questions. Keep responses concise (2-4 paragraphs max).';

      if (codexContext) {
        systemPrompt += `\n\nHere is relevant context from the author's Story Bible (Codex):\n${codexContext}`;
      }

      systemPrompt += outlineContext;

      const aiResponse = await callAIWithHistory(
        config.provider,
        config.apiKey,
        config.baseUrl,
        config.modelName,
        systemPrompt,
        conversationMessages,
      );

      const assistantMessage = await db.chatMessage.create({
        data: {
          role: 'assistant',
          content: aiResponse,
          bookId: bookId || null,
        },
      });

      return NextResponse.json({ userMessage, assistantMessage });
    }

    return NextResponse.json({ error: 'Invalid action. Use "send" or "clear".' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chat operation failed';
    console.error('[AI Chat Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
