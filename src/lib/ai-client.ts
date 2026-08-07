// ── Client-side AI calling for local providers (Ollama, Custom) ──
// When the active provider is Ollama or a custom local LLM, the browser
// calls the LLM directly (since it runs on the user's machine, not on Vercel).

import { PROVIDERS, isLocalProvider } from './ai-provider';

interface ClientAiConfig {
  provider: string;
  baseUrl: string | null;
  modelName: string | null;
}

/**
 * Call Ollama via its native /api/generate endpoint.
 * This is more reliable than the OpenAI-compatible endpoint for some setups.
 */
async function callOllamaNative(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  messages?: { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 2000,
  temperature = 0.8,
): Promise<string> {
  // Derive native base URL from OpenAI-compatible URL or use directly
  const nativeBase = baseUrl.replace(/\/v1\/chat\/completions$/, '').replace(/\/v1\/$/, '');
  const url = `${nativeBase}/api/generate`;

  let prompt: string;
  if (messages && messages.length > 0) {
    prompt = `${systemPrompt}\n\n`;
    for (const m of messages) {
      prompt += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n\n`;
    }
    prompt += 'Assistant: ';
  } else {
    prompt = `${systemPrompt}\n\nUser: ${userMessage}\n\nAssistant: `;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { num_predict: maxTokens, temperature },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama native error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`Ollama error: ${data.error}`);
  return data.response || '';
}

export async function callLocalAI(
  config: ClientAiConfig,
  systemPrompt: string,
  userMessage: string,
  messages?: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  if (!isLocalProvider(config.provider)) {
    throw new Error(`callLocalAI should only be used for local providers (ollama/ollama_native/custom), got: ${config.provider}`);
  }

  const def = PROVIDERS[config.provider];
  const url = config.baseUrl || def.baseUrl;
  const model = config.modelName || def.defaultModel;

  // For ollama_native, use the native endpoint directly
  if (config.provider === 'ollama_native') {
    return callOllamaNative(url, model, systemPrompt, userMessage, messages);
  }

  // For ollama (OpenAI-compatible), try the OpenAI endpoint first, fallback to native
  if (config.provider === 'ollama') {
    const apiMessages = messages
      ? [
          { role: 'system' as const, content: systemPrompt },
          ...messages,
        ]
      : [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: userMessage },
        ];

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          max_tokens: 2000,
          temperature: 0.8,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          return data.choices[0].message.content;
        }
      }
      // If OpenAI-compatible fails, try native
      console.warn('[Ollama] OpenAI-compatible endpoint failed, falling back to native /api/generate');
    } catch {
      // Fall through to native
    }

    return callOllamaNative(url, model, systemPrompt, userMessage, messages);
  }

  // Custom provider — use OpenAI-compatible format
  const apiMessages = messages
    ? [
        { role: 'system' as const, content: systemPrompt },
        ...messages,
      ]
    : [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userMessage },
      ];

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: apiMessages,
      max_tokens: 2000,
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Local LLM error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.error) {
    const errMsg = data.error?.message || JSON.stringify(data.error);
    throw new Error(errMsg);
  }

  return data.choices[0].message.content;
}

/**
 * Fetch the active AI config from the server (to determine provider + baseUrl/model)
 * Returns null if no config or if the provider is cloud-based (not local).
 */
export async function getActiveAiConfig(token: string): Promise<ClientAiConfig | null> {
  try {
    const res = await fetch('/api/ai/config', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const configs = await res.json();
    const active = configs.find((c: { isActive: boolean }) => c.isActive);
    if (!active) return null;
    if (!isLocalProvider(active.provider)) return null;
    return {
      provider: active.provider,
      baseUrl: active.baseUrl || null,
      modelName: active.modelName || null,
    };
  } catch {
    return null;
  }
}

/**
 * Check if Ollama is available by pinging its /api/tags endpoint.
 * Returns list of model names if available, or null if not reachable.
 */
export async function checkOllamaAvailable(baseUrl?: string): Promise<string[] | null> {
  try {
    const base = (baseUrl || 'http://localhost:11434/v1/chat/completions')
      .replace(/\/v1\/chat\/completions$/, '')
      .replace(/\/v1\/$/, '');
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return null;
  }
}
