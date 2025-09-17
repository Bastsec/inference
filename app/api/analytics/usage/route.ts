import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { liteLLMClient } from '@/lib/litellm/client';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get usage analytics for the authenticated user
 * GET /api/analytics/usage?start_date=2024-01-01&end_date=2024-01-31&model=gpt-4&page=1&page_size=50
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const model = searchParams.get('model');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '50'), 100);

    // Get user's virtual keys for filtering
    const { data: userKeys, error: keysError } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, litellm_key_id')
      .eq('user_id', user.id);

    if (keysError) {
      throw keysError;
    }

    // Build local analytics query
    let query = supabaseAdmin
      .from('usage_logs')
      .select(`
        *,
        virtual_keys!inner(key, litellm_key_id)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    if (model) {
      query = query.eq('model', model);
    }

    const { data: localUsage, error: usageError } = await query;

    if (usageError) {
      throw usageError;
    }

    // Get aggregated statistics
    let statsQuery = supabaseAdmin
      .from('usage_logs')
      .select(`
        cost_in_cents.sum(),
        total_tokens.sum(),
        prompt_tokens.sum(),
        completion_tokens.sum(),
        cache_read_input_tokens.sum(),
        cache_creation_input_tokens.sum(),
        model,
        status
      `)
      .eq('user_id', user.id);

    if (startDate) {
      statsQuery = statsQuery.gte('created_at', startDate);
    }
    if (endDate) {
      statsQuery = statsQuery.lte('created_at', endDate);
    }

    const { data: stats, error: statsError } = await statsQuery;

    if (statsError) {
      throw statsError;
    }

    // Calculate totals from local data
    const totals = localUsage.reduce((acc, log) => {
      acc.total_cost_cents += log.cost_in_cents || 0;
      acc.total_tokens += log.total_tokens || 0;
      acc.total_requests += 1;
      acc.successful_requests += log.status === 'success' ? 1 : 0;
      acc.failed_requests += log.status !== 'success' ? 1 : 0;
      return acc;
    }, {
      total_cost_cents: 0,
      total_tokens: 0,
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0
    });

    // Group by model
    const modelBreakdown = localUsage.reduce((acc, log) => {
      const model = log.model || 'unknown';
      if (!acc[model]) {
        acc[model] = {
          cost_cents: 0,
          tokens: 0,
          requests: 0,
          successful_requests: 0,
          failed_requests: 0
        };
      }
      acc[model].cost_cents += log.cost_in_cents || 0;
      acc[model].tokens += log.total_tokens || 0;
      acc[model].requests += 1;
      acc[model].successful_requests += log.status === 'success' ? 1 : 0;
      acc[model].failed_requests += log.status !== 'success' ? 1 : 0;
      return acc;
    }, {} as Record<string, any>);

    // Group by date
    const dailyBreakdown = localUsage.reduce((acc, log) => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          cost_cents: 0,
          tokens: 0,
          requests: 0,
          successful_requests: 0,
          failed_requests: 0
        };
      }
      acc[date].cost_cents += log.cost_in_cents || 0;
      acc[date].tokens += log.total_tokens || 0;
      acc[date].requests += 1;
      acc[date].successful_requests += log.status === 'success' ? 1 : 0;
      acc[date].failed_requests += log.status !== 'success' ? 1 : 0;
      return acc;
    }, {} as Record<string, any>);

    let litellmData = null;

    // Try to get LiteLLM analytics if configured and we have synced keys
    if (liteLLMClient.isConfigured()) {
      const syncedKeys = userKeys.filter(k => k.litellm_key_id);
      
      if (syncedKeys.length > 0) {
        try {
          // Get data for each synced key and aggregate
          const litellmPromises = syncedKeys.map(key =>
            liteLLMClient.withRetry(() =>
              liteLLMClient.getSpendDaily({
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                model: model || undefined,
                api_key: key.litellm_key_id,
                page: 1,
                page_size: 1000 // Get all data for aggregation
              })
            ).catch(error => {
              console.warn(`Failed to get LiteLLM data for key ${key.key}:`, error);
              return null;
            })
          );

          const litellmResults = await Promise.all(litellmPromises);
          const validResults = litellmResults.filter(result => result !== null);

          if (validResults.length > 0) {
            // Aggregate LiteLLM data
            litellmData = {
              total_spend: validResults.reduce((sum, result) => sum + (result!.metadata.total_spend || 0), 0),
              total_tokens: validResults.reduce((sum, result) => sum + (result!.metadata.total_tokens || 0), 0),
              total_requests: validResults.reduce((sum, result) => sum + (result!.metadata.total_spend || 0), 0),
              results: validResults.flatMap(result => result!.results)
            };
          }
        } catch (error) {
          console.warn('Failed to fetch LiteLLM analytics:', error);
        }
      }
    }

    return NextResponse.json({
      local_analytics: {
        usage_logs: localUsage.map(log => ({
          id: log.id,
          model: log.model,
          cost_cents: log.cost_in_cents,
          tokens: {
            total: log.total_tokens,
            prompt: log.prompt_tokens,
            completion: log.completion_tokens,
            cache_read: log.cache_read_input_tokens,
            cache_creation: log.cache_creation_input_tokens
          },
          duration_ms: log.request_duration_ms,
          status: log.status,
          error_message: log.error_message,
          provider: log.provider,
          created_at: log.created_at,
          virtual_key: log.virtual_keys.key.substring(0, 12) + '...'
        })),
        totals,
        breakdown: {
          by_model: modelBreakdown,
          by_date: dailyBreakdown
        }
      },
      litellm_analytics: litellmData,
      pagination: {
        page,
        page_size: pageSize,
        has_more: localUsage.length === pageSize
      },
      metadata: {
        date_range: {
          start: startDate,
          end: endDate
        },
        filters: {
          model
        },
        litellm_configured: liteLLMClient.isConfigured(),
        synced_keys: userKeys.filter(k => k.litellm_key_id).length
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ 
      error: 'Failed to get usage analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
