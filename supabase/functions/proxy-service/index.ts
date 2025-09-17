import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Use environment variables set in the Supabase dashboard.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY')!
const LITELLM_BASE_URL = Deno.env.get('LITELLM_BASE_URL')!

serve(async (req) => {
  // 1. Extract virtual key and request body
  const virtualKey = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!virtualKey) {
    return new Response(JSON.stringify({ error: 'Missing API key' }), { status: 401 })
  }
  const requestBody = await req.json()

  // 2. Authenticate the virtual key and check credit
  const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: keyData, error: keyError } = await supabaseAdmin
    .from('virtual_keys')
    .select('user_id, credit_balance, is_active')
    .eq('key', virtualKey)
    .single()

  if (keyError || !keyData) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 403 })
  }

  if (!keyData.is_active || keyData.credit_balance <= 0) {
    return new Response(JSON.stringify({ error: 'Insufficient credit or inactive key' }), { status: 402 }) // 402 Payment Required
  }

  try {
    // 3. Forward the request to LiteLLM via HTTP
    const endpoint = requestBody?.messages ? '/v1/chat/completions' : '/v1/completions'
    const url = `${LITELLM_BASE_URL}${endpoint}`
    const llmRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LITELLM_MASTER_KEY}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!llmRes.ok) {
      const errText = await llmRes.text()
      console.error('LiteLLM error:', llmRes.status, errText)
      return new Response(JSON.stringify({ error: 'LLM upstream error' }), { status: 502 })
    }

    const responseJson = await llmRes.json()

    // 4. Determine cost of the call
    // Prefer header from LiteLLM server if available
    const headerCost = llmRes.headers.get('x-litellm-cost') || llmRes.headers.get('x-request-cost')
    let costInCents = 0
    if (headerCost) {
      const numeric = Number(headerCost)
      if (!Number.isNaN(numeric)) {
        costInCents = Math.ceil(numeric * 100)
      }
    } else {
      // Fallback: minimal flat cost to avoid abuse until pricing is configured on LiteLLM
      // TODO: replace with accurate usage-based pricing once your LiteLLM server exposes cost headers
      costInCents = 1
    }

    // 5. Decrement the user's balance (atomic operation)
    const { error: rpcError } = await supabaseAdmin.rpc('decrement_credit', {
        key_id: virtualKey,
        amount: costInCents
    });

    if (rpcError) throw rpcError;

    // 6. Return the LLM's response to the user
    return new Response(JSON.stringify(responseJson), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Proxy Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process LLM request' }), { status: 500 })
  }
})

