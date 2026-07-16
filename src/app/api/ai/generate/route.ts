import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, text, sceneContent, mentionedNames, beats, bookId } = await request.json();

    const config = await db.aiConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return NextResponse.json({ error: 'No AI provider configured. Go to Settings to add your API key.' }, { status: 400 });
    }

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
        const aliases: string[] = JSON.parse(e.aliases || '[]');
        const allNames = [e.name, ...aliases].map((n) => n.toLowerCase());
        return mentionedNames.some((mn: string) => allNames.includes(mn.toLowerCase()));
      });

      if (mentioned.length > 0) {
        codexContext = mentioned
          .map((e) => `[${e.type.toUpperCase()}] ${e.name}: ${e.description}`)
          .join('\n');
      }
    }

    const systemPrompt = buildSystemPrompt(action, sceneContent, codexContext);

    let userMessage = '';
    if (action === 'expand') {
      userMessage = `Expand the following passage with more detail, sensory description, and emotional depth while maintaining the author's voice and style:\n\n${text}`;
    } else if (action === 'rewrite') {
      userMessage = `Rewrite the following passage to improve flow, clarity, and prose quality while preserving the original meaning and events:\n\n${text}`;
    } else if (action === 'shorten') {
      userMessage = `Condense the following passage to be more concise while preserving key plot points, character actions, and emotional beats:\n\n${text}`;
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildSystemPrompt(action: string, sceneContent: string, codexContext: string): string {
  let prompt = 'You are a skilled creative writing assistant helping a novelist.';

  if (codexContext) {
    prompt += `\n\nHere is relevant context from the author's Story Bible (Codex):\n${codexContext}`;
  }

  if (sceneContent && action === 'generate_scene') {
    prompt += `\n\nCurrent scene context (what has been written so far in this scene):\n${sceneContent.slice(-2000)}`;
  }

  prompt += '\n\nRespond only with the prose text. Do not include meta-commentary, explanations, or markdown code blocks. Write in a way that seamlessly continues or modifies the existing text.';

  return prompt;
}

// --- Provider registry ---
// Each provider defines: default model, base URL, and whether it uses the
// OpenAI-compatible chat/completions format, the Anthropic format, or the Gemini format.

interface ProviderDef {
  defaultModel: string;
  baseUrl: string;
  format: 'openai' | 'anthropic' | 'google';
}

const PROVIDERS: Record<string, ProviderDef> = {
  openai:      { defaultModel: 'gpt-4o-mini',               baseUrl: 'https://api.openai.com/v1/chat/completions', format: 'openai' },
  anthropic:   { defaultModel: 'claude-sonnet-4-20250514',   baseUrl: 'https://api.anthropic.com/v1/messages', format: 'anthropic' },
  openrouter:  { defaultModel: 'openai/gpt-4o-mini',        baseUrl: 'https://openrouter.ai/api/v1/chat/completions', format: 'openai' },
  groq:        { defaultModel: 'llama-3.3-70b-versatile',   baseUrl: 'https://api.groq.com/openai/v1/chat/completions', format: 'openai' },
  cerebras:    { defaultModel: 'llama-4-scout-17b-16e-instruct', baseUrl: 'https://api.cerebras.ai/v1/chat/completions', format: 'openai' },
  nararouter:  { defaultModel: 'openai/gpt-4o-mini',       baseUrl: 'https://router.bynara.id/v1/chat/completions', format: 'openai' },
  google:      { defaultModel: 'gemini-2.0-flash',          baseUrl: 'https://generativelanguage.googleapis.com/v1beta', format: 'google' },
};

async function callAI(
  provider: string,
  apiKey: string,
  customBaseUrl: string | null,
  modelName: string | null,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const def = PROVIDERS[provider];
  if (!def) throw new Error(`Unknown AI provider: ${provider}. Supported: ${Object.keys(PROVIDERS).join(', ')}`);

  const model = modelName || def.defaultModel;

  // --- Google Gemini (native format) ---
  if (def.format === 'google') {
    const base = customBaseUrl || def.baseUrl;
    const url = `${base}/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.8,
        },
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
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
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content[0].text;
  }

  // --- OpenAI-compatible (covers openai, openrouter, groq, cerebras, nararouter, etc.) ---
  const url = customBaseUrl || def.baseUrl;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.8,
    }),
  });
  const data = await res.json();
  if (data.error) {
    const errMsg = data.error?.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    throw new Error(errMsg);
  }
  return data.choices[0].message.content;
}