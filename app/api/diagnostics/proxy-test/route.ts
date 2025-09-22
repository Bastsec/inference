import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/nextServer';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const supabase = await getServerSupabase();
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user keys and choose the primary (prefer sk- in key; fallback to litellm_key_id)
    const { data: keys, error } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, litellm_key_id, is_active')
      .eq('user_id', authUser.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: 'No active keys found' }, { status: 400 });
    }

    // Choose key to send to proxy (the proxy matches by virtual_keys.key)
    const primary = keys.find(k => typeof k.key === 'string' && k.key.startsWith('sk-'))
      || keys[0];

    const proxyBase = `${process.env.SUPABASE_URL}/functions/v1/proxy-service`;
    const endpoint = `${proxyBase}/v1/chat/completions`;

    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a friendly test agent.' },
        { role: 'user', content: 'Say hello in one short sentence.' }
      ]
    };

    const started = Date.now();
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${primary.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const durationMs = Date.now() - started;
    const text = await resp.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}

    if (!resp.ok) {
      return NextResponse.json({
        error: 'Proxy test request failed',
        status: resp.status,
        body: json || text,
        duration_ms: durationMs
      }, { status: 500 });
    }

    // Pull any useful details
    const costHeader = resp.headers.get('x-request-cost-cents')
      || resp.headers.get('x-litellm-cost');
    const cost_cents = costHeader ? Number(costHeader) : undefined;

    // Try to compute tokens from response usage if present
    const tokens = (json && json.usage) ? {
      prompt: json.usage.prompt_tokens,
      completion: json.usage.completion_tokens,
      total: json.usage.total_tokens
    } : undefined;

    return NextResponse.json({
      ok: true,
      duration_ms: durationMs,
      model: json?.model,
      tokens,
      cost_cents,
      sample: json?.choices?.[0]?.message?.content || null
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

