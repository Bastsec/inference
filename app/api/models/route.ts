import { NextResponse } from 'next/server';
import { liteLLMClient } from '@/lib/litellm/client';

export async function GET(request: Request) {
  try {
    if (!liteLLMClient.isConfigured()) {
      return NextResponse.json({ error: 'LiteLLM not configured' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const litellm_model_id = searchParams.get('litellm_model_id') || undefined;

    const data = await liteLLMClient.getModels(litellm_model_id || undefined);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/models error:', error);
    return NextResponse.json({
      error: 'Failed to fetch models info',
      details: (error as Error).message
    }, { status: 500 });
  }
}
