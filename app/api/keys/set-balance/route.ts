import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { getServerSupabase } from '@/lib/supabase/nextServer';

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Set the active primary key's credit balance (in cents).
 * Body: { cents: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { cents } = await req.json();
    if (!Number.isFinite(cents) || cents < 0) {
      return NextResponse.json({ error: 'Invalid cents' }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find active primary key (prefer sk-)
    const supabaseAdmin = getSupabaseAdmin();
    const { data: keys, error } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, is_active')
      .eq('user_id', authUser.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: 'No keys found' }, { status: 400 });
    }

    const primary = keys.find(k => k.is_active && typeof k.key === 'string' && k.key.startsWith('sk-'))
      || keys.find(k => k.is_active)
      || keys[0];

    const { error: upErr } = await supabaseAdmin
      .from('virtual_keys')
      .update({ credit_balance: Math.round(cents) })
      .eq('id', primary.id);
    if (upErr) throw upErr;

    return NextResponse.json({ ok: true, active_key_mask: `${String(primary.key).slice(0, 6)}***`, credit_balance_cents: Math.round(cents) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
