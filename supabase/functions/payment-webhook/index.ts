import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as crypto from "https://deno.land/std@0.168.0/node/crypto.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!
const LITELLM_BASE_URL = Deno.env.get('LITELLM_BASE_URL')!
const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY')!

// Payment tier configurations
const PAYMENT_TIERS = {
  5: { credits: 10, budget: 5.0 },    // $5 → 10 credits, $5 budget
  10: { credits: 20, budget: 10.0 },  // $10 → 20 credits, $10 budget  
  20: { credits: 40, budget: 20.0 },  // $20 → 40 credits, $20 budget
} as const;

interface LiteLLMKeyUpdateRequest {
  key: string;
  max_budget: number;
  budget_duration: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  // Log incoming request for debugging
  console.log('Payment webhook received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const signature = req.headers.get('x-paystack-signature')
  const body = await req.text()

  console.log('Webhook signature present:', !!signature);
  console.log('Webhook body length:', body.length);

  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(body).digest('hex')
  console.log('Calculated hash:', hash.substring(0, 10) + '...');
  console.log('Received signature:', signature?.substring(0, 10) + '...');
  console.log('Signature match:', hash === signature);

  if (hash !== signature) {
    console.error('Signature validation failed');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  console.log('Signature validation passed');
  const event = JSON.parse(body)

  if (event.event === 'charge.success') {
    const { reference, amount, customer } = event.data
    const userId = event.data.metadata?.user_id as string | undefined
    const email = event.data.metadata?.email as string | undefined
    const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v)
    let resolvedUserId: string | undefined = isUuid(userId) ? userId : undefined

    if (!resolvedUserId && email) {
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (profileErr) {
        console.error('Webhook Error: failed to fetch profile by email', profileErr)
      }
      if (profile?.id) {
        resolvedUserId = profile.id as string
      }
    }

    if (!resolvedUserId) {
      console.error('Webhook Warning: could not resolve user id from metadata', { userId, email })
      return new Response('Webhook processed, but no matching user found', { status: 200 })
    }

    const amountSubunits = amount as number;
    const wholeDollars = Math.floor(amountSubunits / 100);
    
    // Determine payment tier and calculate credits/budget
    const tier = PAYMENT_TIERS[wholeDollars as keyof typeof PAYMENT_TIERS];
    const creditToAdd = tier?.credits || wholeDollars * 2; // fallback to 2x multiplier
    const budgetToAdd = tier?.budget || wholeDollars; // fallback to 1:1 ratio
    
    console.log(`Processing payment: $${wholeDollars} → ${creditToAdd} credits, $${budgetToAdd} budget`);

    // Add credits to database
    const { error: rpcError } = await supabaseAdmin.rpc('add_credit', {
        p_user_id: resolvedUserId,
        p_credit_to_add: creditToAdd
    });

    if (rpcError) {
        console.error('Failed to add credit:', rpcError);
        return new Response('Error updating credit', { status: 500 });
    }

    // Record transaction
    await supabaseAdmin.from('transactions').insert({
        user_id: resolvedUserId,
        amount: amountSubunits,
        credit_added: creditToAdd,
        paystack_ref: reference,
        status: 'success'
    });

    // Update LiteLLM key budget
    try {
      const { data: virtualKeys } = await supabaseAdmin
        .from('virtual_keys')
        .select('id, key, litellm_key_id, max_budget, credit_balance')
        .eq('user_id', resolvedUserId)
        .eq('is_active', true);

      if (virtualKeys && virtualKeys.length > 0) {
        for (const virtualKey of virtualKeys) {
          if (virtualKey.litellm_key_id) {
            // Calculate new total budget (existing + new payment)
            const currentBudget = virtualKey.max_budget || 0;
            const newTotalBudget = (currentBudget / 100) + budgetToAdd; // convert cents to dollars
            
            console.log(`Updating LiteLLM key ${virtualKey.litellm_key_id}: $${currentBudget/100} → $${newTotalBudget}`);

            // Update the LiteLLM key with new budget
            const updatePayload: LiteLLMKeyUpdateRequest = {
              key: virtualKey.litellm_key_id,
              max_budget: newTotalBudget,
              budget_duration: "30d", // 30 day budget cycle
              user_id: resolvedUserId,
              metadata: {
                payment_reference: reference,
                payment_amount: wholeDollars,
                updated_at: new Date().toISOString()
              }
            };

            const litellmResponse = await fetch(`${LITELLM_BASE_URL}/key/update`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updatePayload)
            });

            if (!litellmResponse.ok) {
              const errorText = await litellmResponse.text();
              console.error(`Failed to update LiteLLM key ${virtualKey.litellm_key_id}:`, errorText);
              continue;
            }

            // Update our database with the new budget
            await supabaseAdmin
              .from('virtual_keys')
              .update({ 
                max_budget: Math.round(newTotalBudget * 100), // store as cents
                last_synced_at: new Date().toISOString(),
                sync_status: 'synced'
              })
              .eq('id', virtualKey.id);

            console.log(`Successfully updated LiteLLM key ${virtualKey.litellm_key_id} with $${newTotalBudget} budget`);
          } else {
            console.warn(`Virtual key ${virtualKey.id} has no litellm_key_id, skipping budget update`);
          }
        }
      } else {
        console.warn(`No active virtual keys found for user ${resolvedUserId}`);
      }
    } catch (error) {
      console.error('Failed to update LiteLLM budget after payment:', error);
      // Don't fail the webhook - credits were already added
    }

    console.log(`Successfully added ${creditToAdd} credits to user ${userId}`);
  }

  // 4. Acknowledge receipt of the webhook
  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
