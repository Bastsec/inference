import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { liteLLMMonitoring } from '@/lib/litellm/monitoring';

/**
 * Get LiteLLM monitoring status and metrics
 * GET /api/admin/monitoring
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const hours = parseInt(searchParams.get('hours') || '24');

    switch (action) {
      case 'health':
        const healthCheck = await liteLLMMonitoring.performHealthCheck();
        return NextResponse.json({ health: healthCheck });

      case 'metrics':
        const metrics = await liteLLMMonitoring.getMonitoringMetrics(hours);
        return NextResponse.json({ metrics });

      case 'auto-heal':
        const healResult = await liteLLMMonitoring.attemptAutoHeal();
        return NextResponse.json({ auto_heal: healResult });

      default:
        // Return comprehensive monitoring data
        const [health, metricsData] = await Promise.all([
          liteLLMMonitoring.performHealthCheck(),
          liteLLMMonitoring.getMonitoringMetrics(hours)
        ]);

        const alertCheck = liteLLMMonitoring.shouldAlert(health);

        return NextResponse.json({
          health,
          metrics: metricsData,
          alerts: {
            should_alert: alertCheck.shouldAlert,
            reasons: alertCheck.reasons
          },
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('Monitoring API error:', error);
    return NextResponse.json({ 
      error: 'Failed to get monitoring data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Trigger monitoring actions
 * POST /api/admin/monitoring
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin role check
    // if (user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'run_check':
        const result = await liteLLMMonitoring.runMonitoringCheck();
        return NextResponse.json({ 
          success: true, 
          result,
          message: 'Monitoring check completed'
        });

      case 'auto_heal':
        const healResult = await liteLLMMonitoring.attemptAutoHeal();
        return NextResponse.json({ 
          success: true, 
          result: healResult,
          message: `Auto-heal ${healResult.success ? 'completed successfully' : 'failed'}`
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action',
          available_actions: ['run_check', 'auto_heal']
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Monitoring action error:', error);
    return NextResponse.json({ 
      error: 'Failed to execute monitoring action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
