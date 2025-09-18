import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';

const PLAN_URLS: Record<string, string> = {
  basic: 'https://paystack.shop/pay/1v885uasel',
  pro: 'https://paystack.shop/pay/0h8fkjx9gi',
  advanced: 'https://paystack.shop/pay/a5bbfkky79',
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const plan = (searchParams.get('plan') || '').toLowerCase();

  // Ensure user is signed in before redirecting to checkout
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/sign-in?redirect=/pricing`);
  }

  const target = PLAN_URLS[plan];
  if (!target) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  return NextResponse.redirect(target);
}
