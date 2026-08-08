import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { callAI, isLocalProvider } from '@/lib/ai-provider';

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, apiKey, modelName, baseUrl } = body;

    if (!provider) {
      return NextResponse.json({ success: false, error: 'Provider is required.' }, { status: 400 });
    }

    if (isLocalProvider(provider)) {
      return NextResponse.json({
        success: false,
        error: 'Local providers must be tested directly from the browser.',
      });
    }

    if (!apiKey || apiKey === 'no-key-needed') {
      return NextResponse.json({ success: false, error: 'API key is required for cloud providers.' }, { status: 400 });
    }

    const result = await callAI(
      provider,
      apiKey,
      baseUrl || null,
      modelName || null,
      'You are a helpful assistant.',
      'Say "Connection successful!" in exactly those words. Nothing else.',
      { maxTokens: 20, temperature: 0 },
    );

    const truncated = (result || '').slice(0, 100);
    return NextResponse.json({
      success: true,
      message: `Connected! Reply: "${truncated}"`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Test failed';
    console.error('[AI Test Error]', message);
    return NextResponse.json({ success: false, error: message });
  }
}
