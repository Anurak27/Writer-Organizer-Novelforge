// ── Shared AI Provider Registry & Call Utilities ────────────────────
// Used by: ai/generate, ai/chat, ai/test routes and client-side Ollama calls

export interface ProviderDef {
  defaultModel: string;
  baseUrl: string;
  format: 'openai' | 'anthropic' | 'google' | 'ollama' | 'ollama_native';
}

export const PROVIDERS: Record<string, ProviderDef> = {
  openai:      { defaultModel: 'gpt-4o-mini',               baseUrl: 'https://api.openai.com/v1/chat/completions', format: 'openai' },
  anthropic:   { defaultModel: 'claude-sonnet-4-20250514',   baseUrl: 'https://api.anthropic.com/v1/messages', format: 'anthropic' },
  openrouter:  { defaultModel: 'openai/gpt-4o-mini',        baseUrl: 'https://openrouter.ai/api/v1/chat/completions', format: 'openai' },
  groq:        { defaultModel: 'llama-3.3-70b-versatile',   baseUrl: 'https://api.groq.com/openai/v1/chat/completions', format: 'openai' },
  cerebras:    { defaultModel: 'llama-4-scout-17b-16e-instruct', baseUrl: 'https://api.cerebras.ai/v1/chat/completions', format: 'openai' },
  nararouter:  { defaultModel: 'openai/gpt-4o-mini',       baseUrl: 'https://router.bynara.id/v1/chat/completions', format: 'openai' },
  google:      { defaultModel: 'gemini-2.0-flash',          baseUrl: 'https://generativelanguage.googleapis.com/v1beta', format: 'google' },
  ollama:      { defaultModel: 'llama3.1',                  baseUrl: 'http://localhost:11434/v1/chat/completions', format: 'ollama' },
  ollama_native:{ defaultModel: 'llama3.1',                baseUrl: 'http://localhost:11434/api/generate', format: 'ollama_native' },
  custom:     { defaultModel: 'local-model',              baseUrl: 'http://localhost:1234/v1/chat/completions', format: 'openai' },
};

export function getProviderDef(provider: string): ProviderDef {
  const def = PROVIDERS[provider];
  if (!def) throw new Error(`Unknown AI provider: ${provider}. Supported: ${Object.keys(PROVIDERS).join(', ')}`);
  return def;
}

export function isLocalProvider(provider: string): boolean {  return provider === 'ollama' || provider === 'ollama_native' || provider === 'custom';
}

// ── Server-side AI call (single-turn) ────────────────────────────────
export async function callAI(
  provider: string,
  apiKey: string,
  customBaseUrl: string | null,
  modelName: string | null,
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const def = getProviderDef(provider);
  const model = modelName || def.defaultModel;
  const maxTokens = options?.maxTokens ?? 2000;
  const temperature = options?.temperature ?? 0.8;

  // --- Ollama Native (/api/generate) ---
  if (def.format === 'ollama_native') {
    const url = customBaseUrl || def.baseUrl;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${systemPrompt}\n\nUser: ${userMessage}\n\nAssistant:`,
        stream: false,
        options: { num_predict: maxTokens, temperature },
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama native error (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(`Ollama error: ${data.error}`);
    return data.response || '';
  }

  // --- Google Gemini (native format) ---
  if (def.format === 'google') {
    const base = customBaseUrl || def.baseUrl;
    // Clean the API key: remove whitespace and newlines that may be pasted accidentally
    const cleanKey = apiKey.replace(/[\s\n\r]/g, '');
    const url = `${base}/models/${model}:generateContent?key=${cleanKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
      signal: AbortSignal.timeout(120000),
    });
    const data = await res.json();
    if (data.error) {
      const msg = data.error.message || data.error.status || JSON.stringify(data.error);
      throw new Error(`Gemini API error: ${msg}`);
    }
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const blockReason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason;
      throw new Error(`Gemini returned no content. Reason: ${blockReason || 'unknown'}. Full response: ${JSON.stringify(data).slice(0, 500)}`);
    }
    return data.candidates[0].content.parts[0].text;
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
      body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
      signal: AbortSignal.timeout(120000),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content[0].text;
  }

  // --- OpenAI-compatible (openai, openrouter, groq, cerebras, nararouter, ollama, custom) ---
  const url = customBaseUrl || def.baseUrl;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!isLocalProvider(provider) && apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API request failed (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.error) {
    const errMsg = data.error?.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    throw new Error(errMsg);
  }
  return data.choices[0].message.content;
}

// ── Server-side AI call (multi-turn, for chat) ───────────────────────
export async function callAIWithHistory(
  provider: string,
  apiKey: string,
  customBaseUrl: string | null,
  modelName: string | null,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const def = getProviderDef(provider);
  const model = modelName || def.defaultModel;
  const maxTokens = options?.maxTokens ?? 2000;
  const temperature = options?.temperature ?? 0.8;

  // --- Ollama Native (/api/generate) multi-turn ---
  if (def.format === 'ollama_native') {
    const url = customBaseUrl || def.baseUrl;
    let prompt = `${systemPrompt}\n\n`;
    for (const m of messages) {
      prompt += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n\n`;
    }
    prompt += 'Assistant: ';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { num_predict: maxTokens, temperature },
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama native error (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(`Ollama error: ${data.error}`);
    return data.response || '';
  }

  // --- Google Gemini (native format) ---
  if (def.format === 'google') {
    const base = customBaseUrl || def.baseUrl;
    const cleanKey = apiKey.replace(/[\s\n\r]/g, '');
    const url = `${base}/models/${model}:generateContent?key=${cleanKey}`;
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
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API request failed (${res.status}): ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    if (data.error) {
      const msg = data.error.message || data.error.status || JSON.stringify(data.error);
      throw new Error(`Gemini API error: ${msg}`);
    }
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const blockReason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason;
      throw new Error(`Gemini returned no content. Reason: ${blockReason || 'unknown'}`);
    }
    return data.candidates[0].content.parts[0].text;
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
      body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Anthropic API request failed (${res.status}): ${errText.slice(0, 300)}`);
    }
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
  if (!isLocalProvider(provider) && apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages: apiMessages, max_tokens: maxTokens, temperature }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API request failed (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.error) {
    const errMsg = data.error?.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    throw new Error(errMsg);
  }
  return data.choices[0].message.content;
}
