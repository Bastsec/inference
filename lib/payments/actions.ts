'use server';

import { redirect } from 'next/navigation';
import { initializePaystackTransaction } from './paystack';

export async function topUpAction(formData: FormData) {
  const amountStr = formData.get('amount') as string | null;
  const amountUsd = amountStr ? Number(amountStr) : NaN;
  if (!amountStr || Number.isNaN(amountUsd) || amountUsd <= 0) {
    throw new Error('Invalid amount');
  }

  // Enforce fixed plan amounts
  const allowed = new Set([5, 10, 20]);
  if (!allowed.has(amountUsd)) {
    throw new Error('Invalid plan amount');
  }

  const { authorizationUrl } = await initializePaystackTransaction({
    amountUsd,
  });

  redirect(authorizationUrl);
}
