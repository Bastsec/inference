import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as crypto from "https://deno.land/std@0.168.0/node/crypto.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!

serve(async (req) => {
  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const signature = req.headers.get('x-paystack-signature')
  const body = await req.text()

 
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(body).digest('hex')
  if (hash !== signature) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

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
    const creditToAdd = wholeDollars * 2; // 1 USD   = 2 credits
    const { error: rpcError } = await supabaseAdmin.rpc('add_credit', {
        p_user_id: resolvedUserId,
        p_credit_to_add: creditToAdd
    });

    if (rpcError) {
        console.error('Failed to add credit:', rpcError);
        return new Response('Error updating credit', { status: 500 });
    }

    await supabaseAdmin.from('transactions').insert({
        user_id: resolvedUserId,
        amount: amountSubunits,
        credit_added: creditToAdd,
        paystack_ref: reference,
        status: 'success'
    });

    // Trigger LiteLLM sync for updated budget
    try {
      const { data: virtualKey } = await supabaseAdmin
        .from('virtual_keys')
        .select('litellm_key_id, max_budget, credit_balance')
        .eq('user_id', resolvedUserId)
        .single();

      if (virtualKey?.litellm_key_id) {
        // Call the sync API to update LiteLLM budget
        const baseUrl = Deno.env.get('BASE_URL') || 'http://localhost:3000';
        await fetch(`${baseUrl}/api/keys/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('INTERNAL_API_KEY') || 'internal'}`
          },
          body: JSON.stringify({
            keyId: virtualKey.litellm_key_id,
            action: 'update'
          })
        }).catch(error => {
          console.warn('Failed to sync LiteLLM after payment:', error);
        });
      }
    } catch (error) {
      console.warn('Failed to trigger LiteLLM sync after payment:', error);
    }

    console.log(`Successfully added ${creditToAdd} credits to user ${userId}`);
  }

  // 4. Acknowledge receipt of the webhook
  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
