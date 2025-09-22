import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { liteLLMClient } from '@/lib/litellm/client';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Sync virtual keys with LiteLLM
 * POST /api/keys/sync
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { keyId, action = 'update' } = body;

    if (!liteLLMClient.isConfigured()) {
      return NextResponse.json({ 
        error: 'LiteLLM not configured',
        fallback: 'Using local key management only'
      }, { status: 200 });
    }

    // Get the virtual key from database
    const supabaseAdmin = getSupabaseAdmin();
    const { data: virtualKey, error: keyError } = await supabaseAdmin
      .from('virtual_keys')
      .select('*')
      .eq('id', keyId)
      .eq('user_id', user.id)
      .single();

    if (keyError || !virtualKey) {
      return NextResponse.json({ error: 'Virtual key not found' }, { status: 404 });
    }

    try {
      if (action === 'create' && !virtualKey.litellm_key_id) {
        // Generate new key in LiteLLM
        const litellmResponse = await liteLLMClient.withRetry(() =>
          liteLLMClient.generateKey({
            user_id: user.id.toString(),
            key_alias: `user-${user.id}-${virtualKey.id}`,
            max_budget: virtualKey.max_budget ? virtualKey.max_budget / 100 : undefined, // Convert cents to dollars
            budget_duration: virtualKey.budget_duration || undefined,
            models: virtualKey.model_restrictions ? JSON.parse(virtualKey.model_restrictions) : undefined,
            rpm_limit: virtualKey.rpm_limit || undefined,
            tpm_limit: virtualKey.tpm_limit || undefined,
            metadata: {
              supabase_user_id: user.id,
              supabase_key_id: virtualKey.id,
              ...(virtualKey.metadata ? JSON.parse(virtualKey.metadata) : {})
            },
            guardrails: virtualKey.guardrails ? JSON.parse(virtualKey.guardrails) : undefined,
          })
        );

        // Update local database with LiteLLM key ID
        await getSupabaseAdmin().rpc('update_litellm_sync_status', {
          p_key_id: virtualKey.key,
          p_status: 'synced',
          p_litellm_key_id: litellmResponse.key
        });

        return NextResponse.json({
          success: true,
          action: 'created',
          litellm_key: litellmResponse.key,
          expires: litellmResponse.expires
        });

      } else if (action === 'update' && virtualKey.litellm_key_id) {
        // Update existing key in LiteLLM
        await liteLLMClient.withRetry(() =>
          liteLLMClient.updateKey({
            key: virtualKey.litellm_key_id,
            max_budget: virtualKey.max_budget ? virtualKey.max_budget / 100 : undefined,
            spend: 0, // Reset spend - we track this locally
            rpm_limit: virtualKey.rpm_limit || undefined,
            tpm_limit: virtualKey.tpm_limit || undefined,
            blocked: !virtualKey.is_active,
            models: virtualKey.model_restrictions ? JSON.parse(virtualKey.model_restrictions) : undefined,
            metadata: {
              supabase_user_id: user.id,
              supabase_key_id: virtualKey.id,
              credit_balance: virtualKey.credit_balance,
              ...(virtualKey.metadata ? JSON.parse(virtualKey.metadata) : {})
            },
            guardrails: virtualKey.guardrails ? JSON.parse(virtualKey.guardrails) : undefined,
          })
        );

        // Update sync status
        await getSupabaseAdmin().rpc('update_litellm_sync_status', {
          p_key_id: virtualKey.key,
          p_status: 'synced',
          p_litellm_key_id: virtualKey.litellm_key_id
        });

        return NextResponse.json({
          success: true,
          action: 'updated',
          litellm_key: virtualKey.litellm_key_id
        });

      } else {
        return NextResponse.json({ 
          error: 'Invalid action or key state',
          details: `Action: ${action}, has_litellm_key: ${!!virtualKey.litellm_key_id}`
        }, { status: 400 });
      }

    } catch (litellmError) {
      console.error('LiteLLM sync error:', litellmError);
      
      // Update sync status to failed
      await getSupabaseAdmin().rpc('update_litellm_sync_status', {
        p_key_id: virtualKey.key,
        p_status: 'failed'
      });

      return NextResponse.json({
        error: 'Failed to sync with LiteLLM',
        details: litellmError instanceof Error ? litellmError.message : 'Unknown error',
        fallback: 'Key will work with local enforcement only'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Key sync error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get sync status for user's keys
 * GET /api/keys/sync
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: keys, error } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, litellm_key_id, sync_status, last_synced_at, is_active')
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      keys: keys.map(key => ({
        id: key.id,
        key: key.key.substring(0, 12) + '...', // Mask the key for security
        litellm_synced: !!key.litellm_key_id,
        sync_status: key.sync_status,
        last_synced_at: key.last_synced_at,
        is_active: key.is_active
      })),
      litellm_configured: liteLLMClient.isConfigured()
    });

  } catch (error) {
    console.error('Get sync status error:', error);
    return NextResponse.json({ 
      error: 'Failed to get sync status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
