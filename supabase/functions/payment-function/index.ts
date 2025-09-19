// Alias function for Paystack configurations pointing to "payment-function".
// This mirrors the logic in payment-webhook to support both names.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as crypto from "https://deno.land/std@0.168.0/node/crypto.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!
const LITELLM_BASE_URL = Deno.env.get('LITELLM_BASE_URL') || ''
const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BASE_URL = Deno.env.get('BASE_URL') || ''

// Payment tier configurations
const PAYMENT_TIERS = {
  5: { credits: 10, budget: 5.0 },
  10: { credits: 20, budget: 10.0 },
  20: { credits: 40, budget: 20.0 },
} as const;

async function verifyReference(reference: string) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Verify failed: ${res.status} ${text}`);
  }
  const payload = await res.json();
  if (!payload?.status || !payload?.data) {
    throw new Error('Invalid verify payload');
  }
  return payload.data;
}

serve(async (req) => {
  console.log('[payment-function] Received:', { method: req.method, url: req.url });
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const method = req.method.toUpperCase();

  if (method === 'GET') {
    try {
      const reqUrl = new URL(req.url);
      let returnUrl: string | undefined = undefined;
      const reference = reqUrl.searchParams.get('reference') || reqUrl.searchParams.get('trxref');
      if (!reference) return new Response('Missing reference', { status: 400 });

      console.log('[payment-function][callback] verifying ref:', reference);
      const { data: existing } = await supabaseAdmin
        .from('transactions')
        .select('id, status, credit_added')
        .eq('paystack_ref', reference)
        .order('created_at', { ascending: false })
        .limit(1);
      const alreadyCredited = !!(existing && existing.length > 0 && Number(existing[0].credit_added || 0) > 0);
      if (!alreadyCredited) {
        const data = await verifyReference(reference);
        const payStatus = String(data.status || '').toLowerCase();
        const amountSubunits = Number(data.amount || 0);
        const metadata = (data.metadata || {}) as Record<string, any>;
        const email: string | undefined = data.customer?.email || metadata.email;
        if (typeof metadata?.return_url === 'string') {
          returnUrl = metadata.return_url;
        }

        let resolvedUserId: string | undefined = typeof metadata.user_id === 'string' ? metadata.user_id : undefined;
        if (!resolvedUserId && email) {
          const { data: profilesByEmail } = await supabaseAdmin
            .from('profiles')
            .select('id, created_at')
            .eq('email', email)
            .order('created_at', { ascending: true })
            .limit(1);
          if (profilesByEmail && profilesByEmail.length > 0) {
            resolvedUserId = profilesByEmail[0].id as string;
          }
        }

        if (resolvedUserId && payStatus === 'success') {
          const wholeUnits = Math.floor(amountSubunits / 100);
          const tier = PAYMENT_TIERS[wholeUnits as keyof typeof PAYMENT_TIERS];
          const planUsd = typeof metadata.plan_usd === 'number' ? metadata.plan_usd : undefined;
          const creditDollars = planUsd ?? tier?.credits ?? wholeUnits * 2;
          const creditCents = Math.round(creditDollars * 100);
          const budgetToAdd = planUsd ?? tier?.budget ?? wholeUnits;
          console.log('[payment-function][callback] crediting:', {
            reference,
            resolvedUserId,
            amountSubunits,
            planUsd,
            creditCents,
            budgetToAdd
          });

          // Debug: pre-update balances
          try {
            const { data: beforeKeys } = await supabaseAdmin
              .from('virtual_keys')
              .select('id, credit_balance')
              .eq('user_id', resolvedUserId);
            console.log('[payment-function][callback] balances before:', beforeKeys);
          } catch {}

          // Snapshot balances before
          let beforeTotal = 0;
          try {
            const { data: beforeKeys } = await supabaseAdmin
              .from('virtual_keys')
              .select('credit_balance')
              .eq('user_id', resolvedUserId);
            beforeTotal = (beforeKeys || []).reduce((s: number, k: any) => s + Number(k.credit_balance || 0), 0);
          } catch {}

          const { error: rpcError } = await supabaseAdmin.rpc('add_credit', {
            p_user_id: resolvedUserId,
            p_credit_to_add: creditCents,
          });
          if (rpcError) {
            console.error('[payment-function][callback] add_credit failed:', rpcError);
            // Fallback direct update
            try {
              const { data: keys } = await supabaseAdmin
                .from('virtual_keys')
                .select('id, credit_balance')
                .eq('user_id', resolvedUserId);
              if (keys && keys.length > 0) {
                for (const k of keys) {
                  const current = Number(k.credit_balance || 0);
                  const newBal = current + creditCents;
                  const { error: upErr } = await supabaseAdmin
                    .from('virtual_keys')
                    .update({ credit_balance: newBal })
                    .eq('id', k.id);
                  if (upErr) console.error(`[payment-function][callback] Fallback update failed for key ${k.id}:`, upErr);
                }
                console.log(`[payment-function][callback] Fallback credit applied to ${keys.length} key(s)`);
              } else {
                console.warn('[payment-function][callback] No virtual_keys found for user in fallback');
              }
            } catch (e) {
              console.error('[payment-function][callback] Fallback credit update error:', e);
            }
          }

          // Snapshot balances after and compute credited flag
          let afterTotal = 0;
          try {
            const { data: afterKeys } = await supabaseAdmin
              .from('virtual_keys')
              .select('credit_balance')
              .eq('user_id', resolvedUserId);
            afterTotal = (afterKeys || []).reduce((s: number, k: any) => s + Number(k.credit_balance || 0), 0);
          } catch {}
          const credited = afterTotal - beforeTotal >= creditCents;

          await supabaseAdmin.from('transactions').insert({
            user_id: resolvedUserId,
            amount: amountSubunits,
            credit_added: credited ? creditCents : 0,
            paystack_ref: reference,
            status: credited ? 'success' : 'pending',
          });

          // Debug: post-update balances
          try {
            const { data: afterKeys } = await supabaseAdmin
              .from('virtual_keys')
              .select('id, credit_balance')
              .eq('user_id', resolvedUserId);
            console.log('[payment-function][callback] balances after:', afterKeys);
          } catch {}

          // LiteLLM budget update (best-effort)
          if (LITELLM_BASE_URL && LITELLM_MASTER_KEY) {
            try {
              const { data: virtualKeys } = await supabaseAdmin
                .from('virtual_keys')
                .select('id, key, litellm_key_id, max_budget')
                .eq('user_id', resolvedUserId)
                .eq('is_active', true);
              if (virtualKeys && virtualKeys.length > 0) {
                for (const vk of virtualKeys) {
                  if (!vk.litellm_key_id) continue;
                  const currentBudget = vk.max_budget || 0;
                  const newTotalBudget = (currentBudget / 100) + budgetToAdd;
                  const resp = await fetch(`${LITELLM_BASE_URL}/key/update`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ key: vk.litellm_key_id, max_budget: newTotalBudget, budget_duration: '30d' }),
                  });
                  if (!resp.ok) console.warn('[payment-function][callback] LiteLLM update failed');
                }
              }
            } catch (e) {
              console.warn('[payment-function][callback] LiteLLM update error:', e);
            }
          }
        } else {
          await supabaseAdmin.from('transactions').insert({
            user_id: resolvedUserId || null,
            amount: amountSubunits,
            credit_added: 0,
            paystack_ref: reference,
            status: payStatus,
          });
        }
      }

      const appBase = BASE_URL || returnUrl || reqUrl.origin;
      const redirectPath = Deno.env.get('POST_PAYMENT_REDIRECT_PATH') || '/dashboard';
      const redirectTo = `${appBase}${redirectPath}?status=success&reference=${encodeURIComponent(reference)}`;
      console.log('[payment-function][callback] redirecting to:', redirectTo);
      return new Response(null, { status: 302, headers: { Location: redirectTo } });
    } catch (e) {
      console.error('[payment-function][callback] error:', e);
      const reqUrl2 = new URL(req.url);
      const ref = reqUrl2.searchParams.get('reference') || '';
      const appBase = BASE_URL || reqUrl2.origin;
      const redirectPath = Deno.env.get('POST_PAYMENT_REDIRECT_PATH') || '/dashboard';
      const redirectTo = `${appBase}${redirectPath}?status=failed&reference=${encodeURIComponent(ref)}`;
      console.log('[payment-function][callback] redirecting (failed) to:', redirectTo);
      return new Response(null, { status: 302, headers: { Location: redirectTo } });
    }
  }

  // Webhook (POST)
  const signature = req.headers.get('x-paystack-signature')
  const body = await req.text()
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(body).digest('hex')
  if (hash !== signature) {
    console.error('[payment-function][webhook] Invalid signature');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  const event = JSON.parse(body)
  if (event.event === 'charge.success') {
    const { reference, amount, currency, customer, metadata } = event.data
    const metaUidWebhook = (event.data.metadata?.user_id || event.data.metadata?.user_uuid) as string | undefined
    const email = (event.data.metadata?.email || customer?.email) as string | undefined
    const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v)
    let resolvedUserId: string | undefined = isUuid(metaUidWebhook) ? metaUidWebhook : undefined

    if (!resolvedUserId && email) {
      const { data: profilesByEmail } = await supabaseAdmin
        .from('profiles')
        .select('id, created_at')
        .eq('email', email)
        .order('created_at', { ascending: true })
        .limit(1);
      if (profilesByEmail && profilesByEmail.length > 0) {
        resolvedUserId = profilesByEmail[0].id as string
      }
    }

    // Idempotency
    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select('id, status, credit_added')
      .eq('paystack_ref', reference)
      .order('created_at', { ascending: false })
      .limit(1);
    const alreadyCredited = !!(existing && existing.length > 0 && Number(existing[0].credit_added || 0) > 0);
    if (alreadyCredited) {
      console.log('[payment-function][webhook] already processed:', reference);
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
    }

    const amountSubunits = amount as number;
    const wholeUnits = Math.floor(amountSubunits / 100);
    const tier = PAYMENT_TIERS[wholeUnits as keyof typeof PAYMENT_TIERS];
    const planUsd = typeof metadata?.plan_usd === 'number' ? metadata.plan_usd : undefined;
    const creditToAddDollars = planUsd ?? tier?.credits ?? wholeUnits * 2;
    const creditToAddCents = Math.round(creditToAddDollars * 100);
    const budgetToAdd = planUsd ?? tier?.budget ?? wholeUnits;

    // Snapshot balances before
    let beforeTotal = 0;
    try {
      const { data: beforeKeys } = await supabaseAdmin
        .from('virtual_keys')
        .select('credit_balance')
        .eq('user_id', resolvedUserId);
      beforeTotal = (beforeKeys || []).reduce((s: number, k: any) => s + Number(k.credit_balance || 0), 0);
    } catch {}

    const { error: rpcError } = await supabaseAdmin.rpc('add_credit', {
      p_user_id: resolvedUserId,
      p_credit_to_add: creditToAddCents
    });
    if (rpcError) {
      console.error('[payment-function][webhook] add_credit failed:', rpcError);
      // Fallback direct update
      try {
        const { data: keys } = await supabaseAdmin
          .from('virtual_keys')
          .select('id, credit_balance')
          .eq('user_id', resolvedUserId);
        if (keys && keys.length > 0) {
          for (const k of keys) {
            const current = Number(k.credit_balance || 0);
            const newBal = current + creditToAddCents;
            const { error: upErr } = await supabaseAdmin
              .from('virtual_keys')
              .update({ credit_balance: newBal })
              .eq('id', k.id);
            if (upErr) console.error(`[payment-function][webhook] Fallback update failed for key ${k.id}:`, upErr);
          }
          console.log(`[payment-function][webhook] Fallback credit applied to ${keys.length} key(s)`);
        } else {
          console.warn('[payment-function][webhook] No virtual_keys found for user in fallback');
        }
      } catch (e) {
        console.error('[payment-function][webhook] Fallback credit update error:', e);
      }
    }

    // Snapshot balances after and compute credited flag
    let afterTotal = 0;
    try {
      const { data: afterKeys } = await supabaseAdmin
        .from('virtual_keys')
        .select('credit_balance')
        .eq('user_id', resolvedUserId);
      afterTotal = (afterKeys || []).reduce((s: number, k: any) => s + Number(k.credit_balance || 0), 0);
    } catch {}
    const credited = afterTotal - beforeTotal >= creditToAddCents;

    await supabaseAdmin.from('transactions').insert({
      user_id: resolvedUserId,
      amount: amountSubunits,
      credit_added: credited ? creditToAddCents : 0,
      paystack_ref: reference,
      status: credited ? 'success' : 'pending'
    });

    // LiteLLM budget update (best-effort)
    if (LITELLM_BASE_URL && LITELLM_MASTER_KEY) {
      try {
        const { data: virtualKeys } = await supabaseAdmin
          .from('virtual_keys')
          .select('id, key, litellm_key_id, max_budget')
          .eq('user_id', resolvedUserId)
          .eq('is_active', true);
        if (virtualKeys && virtualKeys.length > 0) {
          for (const vk of virtualKeys) {
            if (!vk.litellm_key_id) continue;
            const currentBudget = vk.max_budget || 0;
            const newTotalBudget = (currentBudget / 100) + budgetToAdd;
            await fetch(`${LITELLM_BASE_URL}/key/update`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ key: vk.litellm_key_id, max_budget: newTotalBudget, budget_duration: '30d' }),
            });
          }
        }
      } catch (e) {
        console.warn('[payment-function][webhook] LiteLLM update error:', e);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
