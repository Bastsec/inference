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

    const { data: keys, error } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, litellm_key_id, credit_balance, is_active, created_at')
      .eq('user_id', authUser.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: 'No keys to consolidate' }, { status: 400 });
    }

    // Determine primary: prefer where key starts with sk-
    const primary = keys.find(k => typeof k.key === 'string' && k.key.startsWith('sk-')) || keys[0];
    const duplicates = keys.filter(k => k.id !== primary.id);

    // Sum balances
    const total = (keys || []).reduce((s, k) => s + (k.credit_balance || 0), 0);

    // Update primary balance and ensure active
    const { error: upErr } = await supabaseAdmin
      .from('virtual_keys')
      .update({ credit_balance: total, is_active: true })
      .eq('id', primary.id);
    if (upErr) throw upErr;

    // Deactivate duplicates (do not delete to preserve history)
    if (duplicates.length > 0) {
      const { error: deErr } = await supabaseAdmin
        .from('virtual_keys')
        .update({ is_active: false })
        .in('id', duplicates.map(d => d.id));
      if (deErr) throw deErr;
    }

    const mask = typeof primary.key === 'string' ? `${primary.key.slice(0, 6)}***` : 'unknown';

    return NextResponse.json({ ok: true, active_key_mask: mask, total_credit_cents: total });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

