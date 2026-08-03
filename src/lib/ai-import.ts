import { db } from './db';

const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string; format: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', format: 'openai' },
  anthropic: { baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-20250514', format: 'anthropic' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini', format: 'openai' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.1-70b-versatile', format: 'openai' },
  cerebras: { baseUrl: 'https://api.cerebras.ai/v1', defaultModel: 'llama-3.3-70b', format: 'openai' },
  nararouter: { baseUrl: 'https://api.nararouter.ai/v1', defaultModel: 'openai/gpt-4o-mini', format: 'openai' },
  google: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.0-flash', format: 'google' },
};

export async function callAIForImport(aiConfig: any, systemPrompt: string, userText: string): Promise<any> {
  const provider = PROVIDERS[aiConfig.provider];
  if (!provider) throw new Error(`Unknown provider: ${aiConfig.provider}`);

  const model = aiConfig.modelName || provider.defaultModel;
  const baseUrl = aiConfig.baseUrl || provider.baseUrl;

  // Truncate text if too long (keep first ~30k chars)
  const truncatedText = userText.length > 30000
    ? userText.slice(0, 30000) + '\n\n[... document truncated for length ...]'
    : userText;

  let responseText = '';

  if (provider.format === 'anthropic') {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': aiConfig.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: truncatedText }],
      }),
    });
    const data = await res.json();
    responseText = data.content?.[0]?.text || '';
  } else if (provider.format === 'google') {
    const res = await fetch(`${baseUrl}/models/${model}:generateContent?key=${aiConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: truncatedText }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    const data = await res.json();
    responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    // OpenAI-compatible
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: truncatedText },
        ],
        temperature: 0.2,
      }),
    });
    const data = await res.json();
    responseText = data.choices?.[0]?.message?.content || '';
  }

  if (!responseText) return null;

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = responseText.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try to find JSON object in the response
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(jsonStr.slice(start, end + 1)); } catch { /* ignore */ }
    }
    return null;
  }
}
