import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Use environment variables set in the Supabase dashboard.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY')!
const LITELLM_BASE_URL = Deno.env.get('LITELLM_BASE_URL')!
const LITELLM_TOKEN_COUNTER_URL = Deno.env.get('LITELLM_TOKEN_COUNTER_URL') || `${LITELLM_BASE_URL}/utils/token_counter`

// LiteLLM API interfaces
interface TokenCountRequest {
  model: string;
  prompt?: string;
  messages?: any[];
}

interface TokenCountResponse {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
}

// Utility function to call LiteLLM token counter with retry
async function countTokens(request: TokenCountRequest, retries = 2): Promise<TokenCountResponse | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(LITELLM_TOKEN_COUNTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Token counter failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn(`Token counting attempt ${attempt + 1} failed:`, error);
      if (attempt === retries) {
        return null;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  return null;
}

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Extract virtual key from Authorization header
  const virtualKey = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!virtualKey) {
    return new Response(JSON.stringify({ error: 'Missing API key' }), { status: 401 });
  }

  // If this is a direct API call (not a passthrough), extract the request body
  let requestBody = null;
  let endpoint = '/v1/chat/completions'; // default

  if (path.startsWith('/v1/')) {
    // This is a direct API call like /v1/chat/completions
    endpoint = path;
    requestBody = await req.json().catch(() => null);
  } else {
    // This is the original proxy format
    requestBody = await req.json();
    endpoint = requestBody?.messages ? '/v1/chat/completions' : '/v1/completions';
  }

  if (!requestBody) {
    return new Response(JSON.stringify({ error: 'Missing request body' }), { status: 400 });
  }

  // 2. Authenticate the virtual key and check credit
  const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: keyData, error: keyError } = await supabaseAdmin
    .from('virtual_keys')
    .select('id, user_id, credit_balance, is_active, litellm_key_id, rpm_limit, tpm_limit, model_restrictions')
    .eq('key', virtualKey)
    .single()

  if (keyError || !keyData) {
    return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 403 })
  }

  if (!keyData.is_active || keyData.credit_balance <= 0) {
    return new Response(JSON.stringify({ error: 'Insufficient credit or inactive key' }), { status: 402 }) // 402 Payment Required
  }

  // 3. Check model restrictions if configured
  const modelRestrictions = keyData.model_restrictions ? JSON.parse(keyData.model_restrictions) : null
  const requestedModel = requestBody?.model
  if (modelRestrictions && requestedModel && !modelRestrictions.includes(requestedModel)) {
    return new Response(JSON.stringify({ error: `Model '${requestedModel}' not allowed for this key` }), { status: 403 })
  }

  const startTime = Date.now()
  let tokenCountData: TokenCountResponse | null = null
  let usageLogId: string | null = null

  try {
    // 4. Forward the request to LiteLLM via HTTP
    // Use the endpoint from the URL path if it's a direct API call, otherwise determine from request body
    let endpoint: string;
    if (path.startsWith('/v1/')) {
      endpoint = path; // Direct API call like /v1/chat/completions
    } else {
      endpoint = requestBody?.messages ? '/v1/chat/completions' : '/v1/completions';
    }
    const url = `${LITELLM_BASE_URL}${endpoint}`
    
    // Use the actual LiteLLM key - no fallback to master key
    const authHeader = `Bearer ${keyData.litellm_key_id}`;
    const llmRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(requestBody)
    })

    if (!llmRes.ok) {
      const errText = await llmRes.text()
      console.error('LiteLLM error:', llmRes.status, errText)
      
      // Log failed request
      await supabaseAdmin.rpc('log_usage', {
        p_user_id: keyData.user_id,
        p_virtual_key_id: keyData.id,
        p_model: requestedModel || 'unknown',
        p_prompt_tokens: 0,
        p_completion_tokens: 0,
        p_total_tokens: 0,
        p_cost_in_cents: 0,
        p_request_duration_ms: Date.now() - startTime
      }).then(({ data }) => {
        if (data) usageLogId = data;
      });

      return new Response(JSON.stringify({ error: 'LLM upstream error' }), { status: 502 })
    }

    const responseJson = await llmRes.json()
    const requestDuration = Date.now() - startTime

    // 5. Get accurate token count from LiteLLM
    if (requestedModel) {
      const tokenRequest: TokenCountRequest = {
        model: requestedModel,
        ...(requestBody?.messages ? { messages: requestBody.messages } : { prompt: requestBody?.prompt || '' })
      }
      tokenCountData = await countTokens(tokenRequest)
    }

    // 6. Determine cost of the call
    // Prefer header from LiteLLM server if available
    const headerCost = llmRes.headers.get('x-litellm-cost') || llmRes.headers.get('x-request-cost')
    let costInCents = 0
    
    if (headerCost) {
      const numeric = Number(headerCost)
      if (!Number.isNaN(numeric)) {
        costInCents = Math.ceil(numeric * 100)
      }
    } else if (tokenCountData) {
      // Fallback: estimate cost based on token count (rough estimate: $0.01 per 1000 tokens)
      costInCents = Math.max(1, Math.ceil(tokenCountData.total_tokens * 0.00001 * 100))
    } else {
      // Final fallback: minimal flat cost
      costInCents = 1
    }

    // 7-8. Atomically log usage and decrement credit
    const { data: logId, error: atomicError } = await supabaseAdmin.rpc('log_usage_and_decrement', {
      p_user_id: keyData.user_id,
      p_virtual_key_id: keyData.id,
      p_model: requestedModel || 'unknown',
      p_prompt_tokens: tokenCountData?.prompt_tokens || 0,
      p_completion_tokens: tokenCountData?.completion_tokens || 0,
      p_total_tokens: tokenCountData?.total_tokens || 0,
      p_cost_in_cents: costInCents,
      p_litellm_model_id: llmRes.headers.get('x-litellm-model-id') || null,
      p_provider: llmRes.headers.get('x-litellm-provider') || null,
      p_request_duration_ms: requestDuration,
      p_key: virtualKey
    });

    if (atomicError) {
      console.error('Atomic usage+credit RPC failed:', atomicError);
      // The DB function marks the usage as voided when the decrement fails.
      return new Response(JSON.stringify({ error: 'Failed to commit usage and credit deduction' }), { status: 500 })
    }

    if (logId) usageLogId = logId as string;

    // 9. Return the LLM's response to the user with optional cost info
    const responseHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    
    // Optionally include cost information in headers (can be disabled for production)
    if (Deno.env.get('INCLUDE_COST_HEADERS') === 'true') {
      responseHeaders['X-Request-Cost-Cents'] = costInCents.toString()
      if (tokenCountData) {
        responseHeaders['X-Token-Count'] = tokenCountData.total_tokens.toString()
      }
    }

    return new Response(JSON.stringify(responseJson), {
      headers: responseHeaders,
      status: 200,
    })
  } catch (error) {
    console.error('Proxy Error:', error)
    
    // Update usage log with error if we have one
    if (usageLogId) {
      await supabaseAdmin
        .from('usage_logs')
        .update({ 
          status: 'error', 
          error_message: error instanceof Error ? error.message : 'Unknown error',
          request_duration_ms: Date.now() - startTime
        })
        .eq('id', usageLogId);
    }
    
    return new Response(JSON.stringify({ error: 'Failed to process LLM request' }), { status: 500 })
  }
})

