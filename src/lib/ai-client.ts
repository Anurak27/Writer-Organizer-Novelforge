// ── Client-side AI calling for local providers (Ollama, Custom) ──
// When the active provider is Ollama or a custom local LLM, the browser
// calls the LLM directly (since it runs on the user's machine, not on Vercel).

import { PROVIDERS, isLocalProvider } from './ai-provider';

interface ClientAiConfig {
  provider: string;
  baseUrl: string | null;
  modelName: string | null;
}

export async function callLocalAI(
  config: ClientAiConfig,
  systemPrompt: string,
  userMessage: string,
  messages?: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  if (!isLocalProvider(config.provider)) {
    throw new Error(`callLocalAI should only be used for local providers (ollama/custom), got: ${config.provider}`);
  }

  const def = PROVIDERS[config.provider];
  const url = config.baseUrl || def.baseUrl;
  const model = config.modelName || def.defaultModel;

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
