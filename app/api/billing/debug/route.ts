import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getServerSupabase } from '@/lib/supabase/nextServer';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await getServerSupabase();
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = authUser.user.id;
    const { data: keys, error: keysErr } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, credit_balance, is_active, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (keysErr) throw keysErr;

    const { data: txs, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, credit_added, status, paystack_ref, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (txErr) throw txErr;

    const totalCents = (keys || []).reduce((s, k: any) => s + (k.credit_balance || 0), 0);
    console.log('[billing/debug] user:', userId, 'keys:', keys?.length || 0, 'total cents:', totalCents);
    console.log('[billing/debug] transactions:', txs?.length || 0);

    return NextResponse.json({
      user_id: userId,
      total_credit_cents: totalCents,
      keys: (keys || []).map((k: any) => ({ id: k.id, key_mask: `${String(k.key).slice(0,6)}***`, credit_balance: k.credit_balance, is_active: k.is_active, created_at: k.created_at })),
      transactions: txs || [],
    });
  } catch (e: any) {
    console.error('[billing/debug] error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}

