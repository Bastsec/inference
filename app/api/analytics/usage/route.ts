import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { liteLLMClient } from '@/lib/litellm/client';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/nextServer';

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
    console.log('Analytics usage request started');

    const user = await getUser();
    if (!user) {
      console.log('User not found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('User authenticated:', user.id);

    // Get Supabase user ID (UUID) for usage_logs queries
    const supabase = await getServerSupabase();
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) {
      console.log('Supabase auth user not found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Supabase user ID:', authUser.user.id);

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('start_date');
    const endDateParam = searchParams.get('end_date');
    const model = searchParams.get('model');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '50'), 100);

    // Set default date range to last 30 days if not provided
    const endDate = endDateParam || new Date().toISOString().split('T')[0]; // Today
    const startDate = startDateParam || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago

    // Get user's virtual keys for filtering
    const { data: userKeys, error: keysError } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, litellm_key_id')
      .eq('user_id', authUser.user.id);

    if (keysError) {
      console.error('Virtual keys error:', keysError);
      throw keysError;
    }
    console.log('Found virtual keys:', userKeys?.length || 0);

    // Build local analytics query
    let query = supabaseAdmin
      .from('usage_logs')
      .select(`
        *,
        virtual_keys!inner(key, litellm_key_id)
      `)
      .eq('user_id', authUser.user.id)
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
      console.error('Usage query error:', usageError);
      throw usageError;
    }
    console.log('Found usage logs:', localUsage?.length || 0);

    // Get aggregated statistics - use raw data and aggregate in JavaScript
    let statsQuery = supabaseAdmin
      .from('usage_logs')
      .select(`
        cost_in_cents,
        total_tokens,
        prompt_tokens,
        completion_tokens,
        cache_read_input_tokens,
        cache_creation_input_tokens,
        model,
        status
      `)
      .eq('user_id', authUser.user.id);

    if (startDate) {
      statsQuery = statsQuery.gte('created_at', startDate);
    }
    if (endDate) {
      statsQuery = statsQuery.lte('created_at', endDate);
    }

    const { data: statsData, error: statsError } = await statsQuery;

    if (statsError) {
      console.error('Stats query error:', statsError);
      throw statsError;
    }
    console.log('Stats data retrieved:', statsData?.length || 0, 'records');

    // Aggregate stats in JavaScript
    const aggregatedStats = statsData?.reduce((acc, log) => {
      acc.total_cost_cents += Number(log.cost_in_cents || 0);
      acc.total_tokens += Number(log.total_tokens || 0);
      acc.prompt_tokens += Number(log.prompt_tokens || 0);
      acc.completion_tokens += Number(log.completion_tokens || 0);
      acc.cache_read_input_tokens += Number(log.cache_read_input_tokens || 0);
      acc.cache_creation_input_tokens += Number(log.cache_creation_input_tokens || 0);

      // Count by model
      if (log.model) {
        if (!acc.models[log.model]) {
          acc.models[log.model] = { count: 0, cost: 0, tokens: 0 };
        }
        acc.models[log.model].count++;
        acc.models[log.model].cost += Number(log.cost_in_cents || 0);
        acc.models[log.model].tokens += Number(log.total_tokens || 0);
      }

      // Count by status
      if (log.status) {
        acc.status_counts[log.status] = (acc.status_counts[log.status] || 0) + 1;
      }

      return acc;
    }, {
      total_cost_cents: 0,
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      models: {} as Record<string, { count: number; cost: number; tokens: number }>,
      status_counts: {} as Record<string, number>
    });

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
              liteLLMClient.getUserDailyActivity({
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                model: model || undefined,
                api_key: key.litellm_key_id
              })
            ).catch(error => {
              console.warn(`Failed to get LiteLLM data for key ${key.key}:`, error);
              return null;
            })
          );

          const litellmResults = await Promise.all(litellmPromises);
          const validResults = litellmResults.filter(result => result !== null);

          if (validResults.length > 0) {
            // Aggregate LiteLLM data across all dates
            let totalSpend = 0;
            let totalTokens = 0;
            let totalRequests = 0;
            const allResults: any[] = [];

            validResults.forEach(result => {
              if (result) {
                // Aggregate data across all dates in the response
                Object.values(result).forEach((dayData: any) => {
                  if (dayData && typeof dayData === 'object') {
                    totalSpend += dayData.spend || 0;
                    totalTokens += dayData.total_tokens || 0;
                    totalRequests += dayData.api_requests || 0;

                    // Add individual day results
                    allResults.push({
                      date: Object.keys(result).find(key => result[key] === dayData),
                      spend: dayData.spend,
                      tokens: dayData.total_tokens,
                      requests: dayData.api_requests,
                      models: dayData.models,
                      api_keys: dayData.api_keys,
                      providers: dayData.providers
                    });
                  }
                });
              }
            });

            litellmData = {
              total_spend: totalSpend,
              total_tokens: totalTokens,
              total_requests: totalRequests,
              results: allResults
            };
          }
        } catch (error) {
          console.warn('Failed to fetch LiteLLM analytics:', error);
        }
      }
    }

    console.log('Preparing response with', localUsage.length, 'usage logs');

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
          end: endDate,
          is_default_range: !startDateParam || !endDateParam // Indicate if default range was used
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
    console.error('Error details:', error instanceof Error ? error.stack : 'Unknown error');
    return NextResponse.json({ 
      error: 'Failed to get usage analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
