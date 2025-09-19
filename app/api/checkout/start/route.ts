import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { buildSignInUrl } from '@/lib/auth/redirects';
import { initializePaystackTransaction } from '@/lib/payments/paystack';

const PLAN_AMOUNTS_USD: Record<'basic' | 'pro' | 'advanced', number> = {
  basic: 5,
  pro: 15,
  advanced: 20,
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const plan = (searchParams.get('plan') || '').toLowerCase();

  // Ensure user is signed in before redirecting to checkout
  const user = await getUser();
  if (!user) {
    const signInUrl = buildSignInUrl({ 
      source: 'pricing', 
      next: '/pricing' 
    });
    return NextResponse.redirect(`${origin}${signInUrl}`);
  }

  if (!['basic', 'pro', 'advanced'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  try {
    const amountUsd = PLAN_AMOUNTS_USD[plan as keyof typeof PLAN_AMOUNTS_USD];
    const { authorizationUrl } = await initializePaystackTransaction({ amountUsd });
    return NextResponse.redirect(authorizationUrl);
  } catch (err) {
    console.error('Paystack init failed:', err);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
