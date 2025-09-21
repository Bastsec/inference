import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';
import { getServerSupabase } from '@/lib/supabase/nextServer';

export async function initializePaystackTransaction(params: {
  amountUsd: number; // amount in USD ($)
  reference?: string; // optional custom reference
}) {
  const user = await getUser();
  if (!user) {
    redirect('/sign-up?redirect=pricing');
  }
  // Fetch Supabase Auth user to get the UUID for reliable metadata
  const supabase = await getServerSupabase();
  const { data: authUser } = await supabase.auth.getUser();
  const supabaseUserId = authUser.user?.id;

  const secret = process.env.PAYSTACK_SECRET_KEY;
  const baseUrl = process.env.BASE_URL;
  const configuredCurrency = (process.env.PAYSTACK_CURRENCY || 'USD').toUpperCase();
  const usdToKesRate = Number(process.env.USD_TO_KES_RATE || 129);
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not set');
  if (!baseUrl) throw new Error('BASE_URL is not set');
  if (configuredCurrency !== 'USD' && configuredCurrency !== 'KES') {
    throw new Error('PAYSTACK_CURRENCY must be either USD or KES');
  }
  if (configuredCurrency === 'KES' && (!Number.isFinite(usdToKesRate) || usdToKesRate <= 0)) {
    throw new Error('USD_TO_KES_RATE must be a positive number');
  }

  // Compute amount in smallest currency unit for Paystack
  const amountMinorUnits = configuredCurrency === 'KES'
    ? Math.round(params.amountUsd * usdToKesRate * 100) // KES has 2 decimal places
    : Math.round(params.amountUsd * 100); // USD cents

  const supabaseUrl = process.env.SUPABASE_URL;
  const functionName = process.env.PAYSTACK_FUNCTION_NAME || 'payment-function';
  const callbackUrl = supabaseUrl
    ? `${supabaseUrl}/functions/v1/${functionName}?cb=1`
    : `${baseUrl}/pricing`;

  const payload = {
    email: user!.email,
    amount: amountMinorUnits,
    callback_url: callbackUrl,
    metadata: {
      // Use Supabase Auth UUID as the authoritative user id for functions
      ...(supabaseUserId ? { user_id: supabaseUserId, user_uuid: supabaseUserId } : {}),
      email: user!.email,
      // Preserve original plan amount in USD so webhook/verification can credit correctly
      plan_usd: params.amountUsd,
      // Provide app base URL so Edge Function can always build a correct redirect
      return_url: baseUrl,
    },
    reference: params.reference,
    currency: configuredCurrency,
  } as const;

  // Debug: log where Paystack will callback
  try {
    console.log('[paystack:init]', {
      currency: configuredCurrency,
      usdToKesRate,
      amountUsd: params.amountUsd,
      amountMinorUnits,
      callback_url: callbackUrl,
      functionName,
      supabaseUrl,
      baseUrl,
    });
  } catch {}

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
