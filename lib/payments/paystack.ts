import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';

export async function initializePaystackTransaction(params: {
  amountUsd: number; // amount in USD ($)
  reference?: string; // optional custom reference
}) {
  const user = await getUser();
  if (!user) {
    redirect('/sign-up?redirect=pricing');
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  const baseUrl = process.env.BASE_URL;
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not set');
  if (!baseUrl) throw new Error('BASE_URL is not set');

  const payload = {
    email: user!.email,
    amount: Math.round(params.amountUsd * 100), // Paystack expects smallest currency unit (cents for USD)
    callback_url: `${baseUrl}/pricing?status=success`,
    metadata: {
      user_id: user!.id,
      email: user!.email,
    },
    reference: params.reference,
    currency: 'USD',
  } as const;

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    // Next.js fetch caching: ensure server-side request each time
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paystack init failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    status: boolean;
    message: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };

  if (!data.status || !data.data?.authorization_url) {
    throw new Error(`Paystack init error: ${data.message}`);
  }

  return {
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
}
