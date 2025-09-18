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
      .select('id, key, credit_balance, is_active, created_at')
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    // Format keys for display
    const formattedKeys = keys
      .filter(key => key.key) // Only show keys that exist
      .map(key => ({
        id: key.id,
        key: key.key,
        key_alias: `Basti API Key`,
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

    // Check if user already has a key
    const { data: existingKey } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, credit_balance')
      .eq('user_id', user.id)
      .single();

    if (existingKey && existingKey.key) {
      return NextResponse.json({
        error: 'Key already exists',
        details: 'You already have an API key. Please contact support to create additional keys.'
      }, { status: 400 });
    }

    // Generate a simple API key
    const apiKey = `basti_${user.id.toString().slice(0, 8)}_${Date.now().toString().slice(-6)}`;
    const initialCredits = 200; // $2.00 worth of credits in cents

    try {
      if (existingKey) {
        // Update existing record
        await supabaseAdmin
          .from('virtual_keys')
          .update({
            key: apiKey,
            credit_balance: initialCredits,
            is_active: true
          })
          .eq('id', existingKey.id);
      } else {
        // Create new virtual key record
        await supabaseAdmin
          .from('virtual_keys')
          .insert({
            user_id: user.id,
            key: apiKey,
            credit_balance: initialCredits,
            is_active: true
          });
      }

      return NextResponse.json({
        success: true,
        key: {
          api_key: apiKey,
          credit_balance: initialCredits / 100, // Return in dollars
          message: 'API key created successfully! You have $2.00 in starter credits.'
        }
      });

    } catch (dbError) {
      console.error('Database key creation error:', dbError);
      return NextResponse.json({
        error: 'Failed to create API key',
        details: dbError instanceof Error ? dbError.message : 'Unknown error'
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
