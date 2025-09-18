import { NextResponse } from 'next/server';
import { liteLLMClient } from '@/lib/litellm/client';

export async function POST(request: Request) {
  try {
    if (!liteLLMClient.isConfigured()) {
      return NextResponse.json({ error: 'LiteLLM not configured' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const call_endpoint = (searchParams.get('call_endpoint') || 'false') === 'true';
    const body = await request.json();

    const data = await liteLLMClient.countTokens(body, call_endpoint);
    return NextResponse.json(data);
  } catch (error) {
    console.error('POST /api/utils/token-count error:', error);
    return NextResponse.json({
      error: 'Failed to count tokens',
      details: (error as Error).message
    }, { status: 500 });
  }
}
