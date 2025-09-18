import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { liteLLMClient } from '@/lib/litellm/client';
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

    // Get user's keys from database
    const { data: keys, error } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, litellm_key_id, max_budget, budget_duration, is_active, created_at, credit_balance')
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    // Format keys for display
    const formattedKeys = keys
      .filter(key => key.litellm_key_id) // Only show keys that have LiteLLM keys
      .map(key => ({
        id: key.id,
        litellm_key: key.litellm_key_id,
        key_alias: `User ${user.id.toString().slice(0, 8)} Key`,
        max_budget: key.max_budget ? key.max_budget / 100 : 0, // Convert cents to dollars
        budget_duration: key.budget_duration || '30d',
        is_active: key.is_active,
        created_at: key.created_at,
        credit_balance: key.credit_balance ? key.credit_balance / 100 : 0, // Convert cents to dollars
        needs_payment: key.credit_balance <= 0 // Flag when credits are exhausted
      }));

    return NextResponse.json({
      keys: formattedKeys,
      litellm_configured: liteLLMClient.isConfigured(),
      litellm_base_url: process.env.LITELLM_BASE_URL || ''
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

    // Check user's current credit balance
    const { data: userKey } = await supabaseAdmin
      .from('virtual_keys')
      .select('credit_balance')
      .eq('user_id', user.id)
      .single();

    const creditBalance = userKey?.credit_balance || 0;
    const budgetInDollars = creditBalance > 0 ? creditBalance / 100 : 2.0; // Use $2 default for new users

    try {
      // Create key in LiteLLM
      const litellmResponse = await liteLLMClient.withRetry(() =>
        liteLLMClient.generateKey({
          user_id: user.id.toString(),
          key_alias: `User ${user.id.toString().slice(0, 8)} Key`,
          max_budget: budgetInDollars, // Use available credit balance or $2 default
          budget_duration: '30d',
          rpm_limit: 100,
          tpm_limit: 10000,
          metadata: {
            supabase_user_id: user.id,
            created_via: 'dashboard'
          }
        })
      );

      // Update or create virtual key record
      const { data: existingKey } = await supabaseAdmin
        .from('virtual_keys')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingKey) {
        // Update existing key
        await supabaseAdmin
          .from('virtual_keys')
          .update({
            litellm_key_id: litellmResponse.key,
            max_budget: Math.round(budgetInDollars * 100), // Convert dollars to cents
            budget_duration: '30d',
            rpm_limit: 100,
            tpm_limit: 10000,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          })
          .eq('id', existingKey.id);
      } else {
        // Create new virtual key record
        await supabaseAdmin
          .from('virtual_keys')
          .insert({
            user_id: user.id,
            key: `proxy-${user.id.toString().slice(0, 8)}-${Date.now()}`, // Generate a simple key for reference
            litellm_key_id: litellmResponse.key,
            credit_balance: Math.round(budgetInDollars * 100), // Set initial credit balance
            max_budget: Math.round(budgetInDollars * 100), // Convert dollars to cents
            budget_duration: '30d',
            rpm_limit: 100,
            tpm_limit: 10000,
            is_active: true,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString()
          });
      }

      return NextResponse.json({
        success: true,
        key: {
          litellm_key: litellmResponse.key,
          expires: litellmResponse.expires
        }
      });

    } catch (litellmError) {
      console.error('LiteLLM key creation error:', litellmError);
      return NextResponse.json({
        error: 'Failed to create LiteLLM key',
        details: litellmError instanceof Error ? litellmError.message : 'Unknown error'
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
