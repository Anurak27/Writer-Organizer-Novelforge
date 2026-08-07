import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { safeJsonParse } from '@/lib/utils';

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

      // Build conversation messages for AI (exclude system messages)
      const conversationMessages = history
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      // Build system prompt
      let systemPrompt =
        'You are a creative writing sparring partner helping a novelist brainstorm ideas, fix plot holes, develop characters, and explore story directions. Be conversational, insightful, and ask follow-up questions. Keep responses concise (2-4 paragraphs max).';

      if (codexContext) {
        systemPrompt += `\n\nHere is relevant context from the author's Story Bible (Codex):\n${codexContext}`;
      }

      systemPrompt += outlineContext;

      // Call AI with full conversation history
      const aiResponse = await callAIWithHistory(
        config.provider,
        config.apiKey,
        config.baseUrl,
        config.modelName,
        systemPrompt,
        conversationMessages,
      );

      // Save assistant message
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// --- Provider registry (same as ai/generate) ---

interface ProviderDef {
  defaultModel: string;
  baseUrl: string;
  format: 'openai' | 'anthropic' | 'google';
}

const PROVIDERS: Record<string, ProviderDef> = {
  openai: { defaultModel: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1/chat/completions', format: 'openai' },
  anthropic: {
    defaultModel: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    format: 'anthropic',
  },
  openrouter: {
    defaultModel: 'openai/gpt-4o-mini',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    format: 'openai',
  },
  groq: {
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    format: 'openai',
  },
  cerebras: {
    defaultModel: 'llama-4-scout-17b-16e-instruct',
    baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
    format: 'openai',
  },
  nararouter: {
    defaultModel: 'openai/gpt-4o-mini',
    baseUrl: 'https://router.bynara.id/v1/chat/completions',
    format: 'openai',
  },
  google: {
    defaultModel: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    format: 'google',
  },
  ollama: {
    defaultModel: 'llama3.1',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    format: 'openai',
  },
  custom: {
    defaultModel: 'local-model',
    baseUrl: 'http://localhost:1234/v1/chat/completions',
    format: 'openai',
  },
};

// --- Multi-turn AI call ---

async function callAIWithHistory(
  provider: string,
  apiKey: string,
  customBaseUrl: string | null,
  modelName: string | null,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const def = PROVIDERS[provider];
  if (!def) {
    throw new Error(`Unknown AI provider: ${provider}. Supported: ${Object.keys(PROVIDERS).join(', ')}`);
  }

  const model = modelName || def.defaultModel;

  // --- Google Gemini (native format) ---
  if (def.format === 'google') {
    const base = customBaseUrl || def.baseUrl;
    const url = `${base}/models/${model}:generateContent?key=${apiKey}`;
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.8,
        },
      }),
    });
    const data = await res.json();
    if (data.error) {
      const msg = data.error.message || data.error.status || JSON.stringify(data.error);
      throw new Error(`Gemini API error: ${msg}`);
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // --- Anthropic (native format) ---
  if (def.format === 'anthropic') {
    const url = customBaseUrl || def.baseUrl;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: systemPrompt,
        messages,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content[0].text;
  }

  // --- OpenAI-compatible ---
  const url = customBaseUrl || def.baseUrl;
  const apiMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider !== 'ollama' && provider !== 'custom' && apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: apiMessages,
      max_tokens: 2000,
      temperature: 0.8,
    }),
  });
  const data = await res.json();
  if (data.error) {
    const errMsg =
      data.error?.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    throw new Error(errMsg);
  }
  return data.choices[0].message.content;
}