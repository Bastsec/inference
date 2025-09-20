import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { liteLLMClient } from '@/lib/litellm/client';
import { getServerSupabase } from '@/lib/supabase/nextServer';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get user's LiteLLM keys
 * GET /api/keys/manage
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Supabase user ID
    const supabase = await getServerSupabase();
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's keys from database using Supabase user ID
    let { data: keys, error } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, user_id, credit_balance, is_active, created_at, litellm_key_id, max_budget, budget_duration, rpm_limit, tpm_limit, sync_status, last_synced_at')
      .eq('user_id', authUser.user.id);

    if (error) {
      throw error;
    }

    // Auto-provision a LiteLLM key if none exists yet so free $2 trial is usable immediately
    if (liteLLMClient.isConfigured()) {
      const hasSkKey = (keys || []).some(k => typeof k.key === 'string' && k.key.startsWith('sk-'))
        || (keys || []).some(k => typeof (k as any).litellm_key_id === 'string' && (k as any).litellm_key_id.startsWith('sk-'));
      if (!hasSkKey) {
        try {
          const target = (keys && keys[0]) || null;
          const initialCredits = target?.credit_balance ?? 200; // default $2.00 if absent
          const liteLLMKey = await liteLLMClient.generateKey({
            user_id: authUser.user.id,
            key_alias: `User ${authUser.user.id.slice(0, 8)}`,
            max_budget: (target?.max_budget ?? initialCredits) / 100,
            budget_duration: target?.budget_duration || '30d',
            rpm_limit: target?.rpm_limit || 100,
            tpm_limit: target?.tpm_limit || 100000,
          });

          if (target) {
            await supabaseAdmin
              .from('virtual_keys')
              .update({
                key: liteLLMKey.key,
                litellm_key_id: liteLLMKey.key,
                is_active: true,
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
                // preserve existing credit balance and max_budget; if missing set based on initial
                credit_balance: target.credit_balance ?? initialCredits,
                max_budget: target.max_budget ?? initialCredits,
              })
              .eq('id', target.id);
          } else {
            await supabaseAdmin
              .from('virtual_keys')
              .insert({
                user_id: authUser.user.id,
                key: liteLLMKey.key,
                litellm_key_id: liteLLMKey.key,
                credit_balance: initialCredits,
                is_active: true,
                max_budget: initialCredits,
                budget_duration: '30d',
                rpm_limit: 100,
                tpm_limit: 100000,
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
              });
          }

          // Refetch keys after provisioning
          const refetch = await supabaseAdmin
            .from('virtual_keys')
            .select('id, key, user_id, credit_balance, is_active, created_at, litellm_key_id, max_budget, budget_duration, rpm_limit, tpm_limit, sync_status, last_synced_at')
            .eq('user_id', authUser.user.id);
          keys = refetch.data || keys;
        } catch (provisionErr) {
          console.warn('[keys/manage] auto-provision LiteLLM key failed:', provisionErr);
        }
      }
    }

    // Debug: log raw balances (mask key)
    try {
      const debugBalances = (keys || []).map(k => ({
        id: k.id,
        key_mask: typeof k.key === 'string' ? `${k.key.slice(0, 6)}***` : null,
        credit_balance_cents: k.credit_balance,
        is_active: k.is_active,
        created_at: k.created_at,
      }));
      const totalCents = debugBalances.reduce((s, k) => s + (k.credit_balance_cents || 0), 0);
      console.log('[keys/manage] fetched keys:', debugBalances);
      console.log('[keys/manage] total credit (cents):', totalCents, '($', (totalCents/100).toFixed(2), ')');
    } catch (e) {
      console.warn('[keys/manage] debug log failed:', e);
    }

    // Format keys for display
    const formattedKeys = (keys || [])
      .map(k => {
        const keyStr = typeof k.key === 'string' ? k.key : '';
        const litellmKey = typeof (k as any).litellm_key_id === 'string' ? (k as any).litellm_key_id : '';
        // Prefer plain LiteLLM key (sk-...) if available
        const displayKey = keyStr.startsWith('sk-') ? keyStr : (litellmKey.startsWith('sk-') ? litellmKey : keyStr);
        return {
          id: k.id,
          key: displayKey,
          key_alias: `Basti API Key`,
          is_active: k.is_active,
          created_at: k.created_at,
          credit_balance: k.credit_balance ? k.credit_balance / 100 : 0, // Convert cents to dollars
          needs_payment: k.credit_balance <= 0 // Flag when credits are exhausted
        };
      })
      .filter(item => typeof item.key === 'string' && item.key.startsWith('sk-'));

    const totalCreditsDollars = formattedKeys.reduce((sum, k) => sum + (k.credit_balance || 0), 0);
    console.log('[keys/manage] formatted total ($):', totalCreditsDollars.toFixed(2));

    return NextResponse.json({
      keys: formattedKeys,
      litellm_configured: liteLLMClient.isConfigured(),
      litellm_base_url: `${process.env.SUPABASE_URL}/functions/v1/proxy-service`
    });

  } catch (error) {
    console.error('Get keys error:', error);
    return NextResponse.json({ 
      error: 'Failed to get keys',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Create a new LiteLLM key
 * POST /api/keys/manage
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action !== 'create') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!liteLLMClient.isConfigured()) {
      return NextResponse.json({ 
        error: 'LiteLLM not configured',
        details: 'Please configure LiteLLM environment variables'
      }, { status: 400 });
    }

    // Get Supabase user ID
    const supabase = await getServerSupabase();
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has a key
    const { data: existingKey } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, litellm_key_id')
      .eq('user_id', authUser.user.id)
      .single();

    if (existingKey && existingKey.litellm_key_id) {
      return NextResponse.json({
        error: 'Key already exists',
        details: 'You already have an API key. Please contact support to create additional keys.'
      }, { status: 400 });
    }

    const initialCredits = 200; // $2.00 worth of credits in cents

    try {
      // Create actual LiteLLM key
      const liteLLMKey = await liteLLMClient.generateKey({
        user_id: authUser.user.id,
        key_alias: `User ${authUser.user.id.slice(0, 8)}`,
        max_budget: 2.0, // $2.00 budget
        budget_duration: '30d',
        rpm_limit: 100,
        tpm_limit: 100000
      });

      console.log('LiteLLM key created via API:', liteLLMKey);

      // Store in our virtual_keys table
      if (existingKey) {
        // Update existing record
        await supabaseAdmin
          .from('virtual_keys')
          .update({
            key: liteLLMKey.key,
            credit_balance: initialCredits,
            is_active: true,
            litellm_key_id: liteLLMKey.key,
            max_budget: initialCredits,
            budget_duration: '30d',
            rpm_limit: 100,
            tpm_limit: 100000,
            model_restrictions: null, // No model restrictions - allow all models including gpt-5, model-router, gpt-5-chat
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          })
          .eq('id', existingKey.id);
      } else {
        // Create new virtual key record
        await supabaseAdmin
          .from('virtual_keys')
          .insert({
            user_id: authUser.user.id,
            key: liteLLMKey.key,
            credit_balance: initialCredits,
            is_active: true,
            litellm_key_id: liteLLMKey.key,
            max_budget: initialCredits,
            budget_duration: '30d',
            rpm_limit: 100,
            tpm_limit: 100000,
            model_restrictions: null, // No model restrictions - allow all models including gpt-5, model-router, gpt-5-chat
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          });
      }

      return NextResponse.json({
        success: true,
        key: {
          api_key: liteLLMKey.key,
          credit_balance: initialCredits / 100, // Return in dollars
          message: 'API key created successfully! You have $2.00 in starter credits.'
        }
      });

    } catch (liteLLMError) {
      console.error('Failed to create LiteLLM key via API:', liteLLMError);
      return NextResponse.json({
        error: 'Failed to create LiteLLM key',
        details: liteLLMError instanceof Error ? liteLLMError.message : 'Unknown LiteLLM error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Key creation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
