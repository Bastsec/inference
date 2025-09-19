import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getServerSupabase } from '@/lib/supabase/nextServer';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await getServerSupabase();
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const phone: string | undefined = body?.phone;
    const amountKes: number | undefined = typeof body?.amountKes === 'number' ? body.amountKes : undefined;
    const planUsd: number | undefined = typeof body?.planUsd === 'number' ? body.planUsd : undefined;

    if (!phone || !/^[0-9+]{7,15}$/.test(phone)) {
      return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
    }
    if (!amountKes || amountKes <= 0) {
      return NextResponse.json({ error: 'Invalid amountKes' }, { status: 400 });
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: 'PAYSTACK_SECRET_KEY not configured' }, { status: 500 });
    }

    const payload = {
      amount: Math.round(amountKes * 100),
      email: user.email,
      currency: 'KES',
      mobile_money: {
        phone,
        provider: 'mpesa' as const,
      },
      metadata: {
        user_id: authUser.user.id,
        email: user.email,
        ...(typeof planUsd === 'number' ? { plan_usd: planUsd } : {}),
      },
    };

    const res = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {
      return NextResponse.json({ error: `Paystack failed: ${res.status}`, details: text }, { status: 502 });
    }

    // Expect data.status = true and data.data.status may be 'pay_offline'
    return NextResponse.json(data, { status: res.ok ? 200 : 502 });
  } catch (err) {
    console.error('MPESA init error:', err);
    return NextResponse.json({ error: 'Failed to initialize M-PESA charge' }, { status: 500 });
  }
}

