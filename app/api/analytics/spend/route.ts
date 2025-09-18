import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/nextServer';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// DB-first analytics endpoint using Supabase client
import { liteLLMClient } from '@/lib/litellm/client';

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Supabase user ID (UUID) for usage_logs queries
    const supabase = await getServerSupabase();
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const model = searchParams.get('model');
    const api_key = searchParams.get('api_key');

    const start = start_date ? new Date(start_date) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = end_date ? new Date(end_date) : new Date();

    // Build query using Supabase client
    let query = supabaseAdmin
      .from('usage_logs')
      .select(`
        *,
        virtual_keys!inner(key)
      `)
      .eq('user_id', authUser.user.id)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (model) {
      query = query.eq('model', model);
    }

    if (api_key) {
      query = query.eq('virtual_keys.key', api_key);
    }

    const { data: rows, error } = await query;

    if (error) {
      throw error;
    }

    // Process rows and aggregate by date
    const byDate = new Map<string, any>();
    const breakdown = {
      models: new Map<string, { spend: number; requests: number; tokens: number }>(),
      api_keys: new Map<string, { spend: number; requests: number; tokens: number }>(),
      providers: new Map<string, { spend: number; requests: number; tokens: number }>(),
    };

    let total_spend = 0;
    let total_tokens = 0;

    for (const r of rows || []) {
      const date = new Date(r.created_at).toISOString().split('T')[0];
      const spend = Number(r.cost_in_cents || 0);
      const tokens = Number(r.total_tokens || 0);

      total_spend += spend;
      total_tokens += tokens;

      if (!byDate.has(date)) {
        byDate.set(date, {
          date,
          metrics: {
            spend: 0,
            prompt_tokens: 0,
            completion_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
            total_tokens: 0,
            api_requests: 0,
          },
          breakdown: {
            models: {},
            api_keys: {},
            providers: {},
          },
        });
      }
      
      const day = byDate.get(date);
      day.metrics.spend += spend;
      day.metrics.prompt_tokens += Number(r.prompt_tokens || 0);
      day.metrics.completion_tokens += Number(r.completion_tokens || 0);
      day.metrics.total_tokens += tokens;
      day.metrics.api_requests += 1;

      // breakdown - models
      if (r.model) {
        const prev = breakdown.models.get(r.model) || { spend: 0, requests: 0, tokens: 0 };
        prev.spend += spend;
        prev.requests += 1;
        prev.tokens += tokens;
        breakdown.models.set(r.model, prev);
        day.breakdown.models[r.model] = prev;
      }
      
      // api_keys breakdown
      const apiKeyKey = r.virtual_keys?.key || r.virtual_key_id || 'unknown';
      {
        const prev = breakdown.api_keys.get(apiKeyKey) || { spend: 0, requests: 0, tokens: 0 };
        prev.spend += spend;
        prev.requests += 1;
        prev.tokens += tokens;
        breakdown.api_keys.set(apiKeyKey, prev);
        day.breakdown.api_keys[apiKeyKey] = prev;
      }
      
      // providers breakdown
      if (r.provider) {
        const prev = breakdown.providers.get(r.provider) || { spend: 0, requests: 0, tokens: 0 };
        prev.spend += spend;
        prev.requests += 1;
        prev.tokens += tokens;
        breakdown.providers.set(r.provider, prev);
        day.breakdown.providers[r.provider] = prev;
      }
    }

    const results = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      results,
      metadata: {
        total_spend,
        total_tokens,
        page: 1,
        total_pages: 1,
        has_more: false,
      }
    });
  } catch (error) {
    console.error('GET /api/analytics/spend error:', error);

    // Optional fallback to LiteLLM endpoint for spend if configured
    if (process.env.LITELLM_SPEND_FALLBACK === 'true' && liteLLMClient.isConfigured()) {
      try {
        const { searchParams } = new URL(request.url);
        const start_date = searchParams.get('start_date') || undefined;
        const end_date = searchParams.get('end_date') || undefined;
        const model = searchParams.get('model') || undefined;
        const api_key = searchParams.get('api_key') || undefined;
        const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
        const page_size = searchParams.get('page_size') ? Number(searchParams.get('page_size')) : undefined;
        const data = await liteLLMClient.getSpendDaily({ start_date, end_date, model, api_key, page, page_size });
        return NextResponse.json(data);
      } catch (fallbackErr) {
        console.error('Fallback LiteLLM spend failed:', fallbackErr);
      }
    }

    return NextResponse.json({
      error: 'Failed to fetch spend analytics',
      details: (error as Error).message
    }, { status: 500 });
  }
}
