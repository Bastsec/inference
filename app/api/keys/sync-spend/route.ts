import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { getServerSupabase } from '@/lib/supabase/nextServer';
import { liteLLMClient } from '@/lib/litellm/client';

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Sync spend from LiteLLM for active keys and adjust local credit.
 * Listener mode: users call LiteLLM directly; we reconcile balances here.
 * - Stores progress in virtual_keys.metadata as JSON:
 *   { litellm_spend_synced_cents: number, last_spend_sync_at: string }
 */
export async function POST() {
  try {
    if (!liteLLMClient.isConfigured()) {
      return NextResponse.json({ error: 'LiteLLM not configured' }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: keys, error } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, litellm_key_id, is_active, metadata')
      .eq('user_id', authUser.user.id)
      .eq('is_active', true);
    if (error) throw error;
    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: 'No active keys' }, { status: 400 });
    }

    const results: any[] = [];

    // Helper to format YYYY-MM-DD
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    for (const k of keys) {
      if (!k.litellm_key_id) continue;
      // Determine date range: since last sync day or last 30 days
      let startDate: string;
      const today = new Date();
      const endDate = fmt(today);
      try {
        const meta = k.metadata ? JSON.parse(k.metadata) : {};
        if (typeof meta.last_spend_sync_day === 'string') {
          startDate = meta.last_spend_sync_day;
        } else {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          startDate = fmt(d);
        }
      } catch {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = fmt(d);
      }

      // Pull aggregated spend for this API key within the window
      let daily: any = null;
      try {
        daily = await liteLLMClient.withRetry(
          () => liteLLMClient.getUserDailyActivityAggregated({
            api_key: k.litellm_key_id!,
            start_date: startDate,
            end_date: endDate,
          }),
          1,
          400
        );
      } catch (e) {
        results.push({ key_id: k.id, period_start: startDate, period_end: endDate, error: (e as Error).message });
        continue;
      }

      // Iterate days and write usage log per non-zero spend day
      let totalDeltaCents = 0;
      const entries = Object.entries(daily as Record<string, any>)
        .filter(([day]) => day >= startDate && day <= endDate)
        .sort(([a], [b]) => a.localeCompare(b));

      for (const [day, info] of entries) {
        const spendDollars = Number((info as any)?.spend || 0);
        const cents = Math.max(0, Math.round(spendDollars * 100));
        if (cents <= 0) continue;

        // Decrement and log for this day
        const { data: logId, error: rpcErr } = await supabaseAdmin.rpc('log_usage_and_decrement', {
          p_user_id: authUser.user.id,
          p_virtual_key_id: k.id,
          p_model: 'litellm-rollup',
          p_prompt_tokens: 0,
          p_completion_tokens: 0,
          p_total_tokens: 0,
          p_cost_in_cents: cents,
          p_litellm_model_id: null,
          p_provider: 'litellm',
          p_request_duration_ms: 0,
          p_key: k.key
        });
        if (rpcErr) throw rpcErr;

        // Set created_at to the day for accurate analytics grouping
        if (logId) {
          const dayIso = `${day}T00:00:00Z`;
          await supabaseAdmin
            .from('usage_logs')
            .update({ created_at: dayIso })
            .eq('id', logId as string);
        }

        totalDeltaCents += cents;
      }

      // Only advance last_spend_sync_day if we had a successful fetch
      const meta = k.metadata ? (() => { try { return JSON.parse(k.metadata); } catch { return {}; } })() : {};
      meta.last_spend_sync_day = endDate;
      meta.last_spend_sync_at = new Date().toISOString();
      await supabaseAdmin
        .from('virtual_keys')
        .update({ metadata: JSON.stringify(meta) })
        .eq('id', k.id);

      results.push({ key_id: k.id, period_start: startDate, period_end: endDate, synced_delta_cents: totalDeltaCents });
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error('[sync-spend] error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
