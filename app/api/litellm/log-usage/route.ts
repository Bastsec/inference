import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (authToken !== process.env.USAGE_CALLBACK_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      user_api_key,
      cost_in_usd,
      model,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      duration_ms,
      litellm_model_id,
      provider
    } = body;

    if (!user_api_key || typeof cost_in_usd !== 'number' || cost_in_usd <= 0) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const costInCents = Math.round(cost_in_usd * 100);

    const { data: virtualKey, error: keyError } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, user_id')
      .eq('key', user_api_key)
      .single();

    if (keyError || !virtualKey) {
      return NextResponse.json({ error: 'Virtual key not found' }, { status: 404 });
    }

    const { error: rpcError } = await supabaseAdmin.rpc('log_usage_and_decrement', {
      p_user_id: virtualKey.user_id,
      p_virtual_key_id: virtualKey.id,
      p_model: model || 'unknown',
      p_prompt_tokens: prompt_tokens || 0,
      p_completion_tokens: completion_tokens || 0,
      p_total_tokens: total_tokens || 0,
      p_cost_in_cents: costInCents,
      p_litellm_model_id: litellm_model_id || null,
      p_provider: provider || null,
      p_request_duration_ms: duration_ms || 0,
      p_key: user_api_key
    });

    if (rpcError) {
      console.error('Failed to log usage and decrement credit:', rpcError);
      return NextResponse.json({ error: 'Failed to process usage data' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Log usage error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
  }
}