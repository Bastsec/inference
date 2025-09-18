import { NextResponse } from 'next/server';
import { liteLLMClient } from '@/lib/litellm/client';

export async function GET(request: Request) {
  try {
    if (!liteLLMClient.isConfigured()) {
      return NextResponse.json({ error: 'LiteLLM not configured' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model');
    if (!model) {
      return NextResponse.json({ error: 'Missing "model" query param' }, { status: 400 });
    }

    const data = await liteLLMClient.getSupportedOpenAIParams(model);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/utils/supported-openai-params error:', error);
    return NextResponse.json({
      error: 'Failed to fetch supported params',
      details: (error as Error).message
    }, { status: 500 });
  }
}
