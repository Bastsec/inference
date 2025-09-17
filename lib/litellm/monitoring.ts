/**
 * LiteLLM Health Monitoring and Alerting
 */

import { liteLLMClient } from './client';
import { createClient } from '@supabase/supabase-js';

interface HealthCheckResult {
  timestamp: Date;
  litellm_configured: boolean;
  litellm_reachable: boolean;
  response_time_ms: number | null;
  error_message: string | null;
  sync_status: {
    total_keys: number;
    synced_keys: number;
    failed_keys: number;
    pending_keys: number;
  };
}

interface AlertThresholds {
  response_time_ms: number;
  failed_sync_percentage: number;
  consecutive_failures: number;
}

class LiteLLMMonitoring {
  private supabase;
  private alertThresholds: AlertThresholds;
  private consecutiveFailures = 0;

  constructor(alertThresholds: AlertThresholds = {
    response_time_ms: 5000,
    failed_sync_percentage: 20,
    consecutive_failures: 3
  }) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.alertThresholds = alertThresholds;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      timestamp: new Date(),
      litellm_configured: liteLLMClient.isConfigured(),
      litellm_reachable: false,
      response_time_ms: null,
      error_message: null,
      sync_status: {
        total_keys: 0,
        synced_keys: 0,
        failed_keys: 0,
        pending_keys: 0
      }
    };

    // Check LiteLLM reachability
    if (result.litellm_configured) {
      try {
        // Simple health check - try to count tokens for a minimal request
        await liteLLMClient.withRetry(() =>
          liteLLMClient.countTokens({
            model: 'gpt-3.5-turbo',
            prompt: 'test'
          })
        );
        
        result.litellm_reachable = true;
        result.response_time_ms = Date.now() - startTime;
        this.consecutiveFailures = 0;
      } catch (error) {
        result.error_message = error instanceof Error ? error.message : 'Unknown error';
        this.consecutiveFailures++;
      }
    }

    // Check sync status
    try {
      const { data: keys, error } = await this.supabase
        .from('virtual_keys')
        .select('sync_status');

      if (!error && keys) {
        result.sync_status.total_keys = keys.length;
        result.sync_status.synced_keys = keys.filter(k => k.sync_status === 'synced').length;
        result.sync_status.failed_keys = keys.filter(k => k.sync_status === 'failed').length;
        result.sync_status.pending_keys = keys.filter(k => k.sync_status === 'pending').length;
      }
    } catch (error) {
      console.error('Failed to check sync status:', error);
    }

    return result;
  }

  /**
   * Check if alerts should be triggered
   */
  shouldAlert(healthCheck: HealthCheckResult): {
    shouldAlert: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // Check consecutive failures
    if (this.consecutiveFailures >= this.alertThresholds.consecutive_failures) {
      reasons.push(`${this.consecutiveFailures} consecutive LiteLLM failures`);
    }

    // Check response time
    if (healthCheck.response_time_ms && 
        healthCheck.response_time_ms > this.alertThresholds.response_time_ms) {
      reasons.push(`High response time: ${healthCheck.response_time_ms}ms`);
    }

    // Check sync failure percentage
    const { sync_status } = healthCheck;
    if (sync_status.total_keys > 0) {
      const failurePercentage = (sync_status.failed_keys / sync_status.total_keys) * 100;
      if (failurePercentage > this.alertThresholds.failed_sync_percentage) {
        reasons.push(`High sync failure rate: ${failurePercentage.toFixed(1)}%`);
      }
    }

    return {
      shouldAlert: reasons.length > 0,
      reasons
    };
  }

  /**
   * Send alert (implement your preferred alerting method)
   */
  async sendAlert(healthCheck: HealthCheckResult, reasons: string[]): Promise<void> {
    const alertMessage = {
      timestamp: healthCheck.timestamp,
      severity: 'warning',
      service: 'LiteLLM Integration',
      reasons,
      details: {
        litellm_configured: healthCheck.litellm_configured,
        litellm_reachable: healthCheck.litellm_reachable,
        response_time_ms: healthCheck.response_time_ms,
        error_message: healthCheck.error_message,
        sync_status: healthCheck.sync_status,
        consecutive_failures: this.consecutiveFailures
      }
    };

    // Log to console (replace with your alerting system)
    console.error('LiteLLM Alert:', JSON.stringify(alertMessage, null, 2));

    // Example: Send to Slack, email, or monitoring service
    // await this.sendToSlack(alertMessage);
    // await this.sendEmail(alertMessage);
    
    // Store alert in database for tracking
    try {
      await this.supabase
        .from('system_alerts')
        .insert({
          service: 'litellm',
          severity: 'warning',
          message: reasons.join('; '),
          details: alertMessage.details,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to store alert:', error);
    }
  }

  /**
   * Run monitoring check with alerting
   */
  async runMonitoringCheck(): Promise<HealthCheckResult> {
    const healthCheck = await this.performHealthCheck();
    const alertCheck = this.shouldAlert(healthCheck);

    if (alertCheck.shouldAlert) {
      await this.sendAlert(healthCheck, alertCheck.reasons);
    }

    return healthCheck;
  }

  /**
   * Get monitoring metrics for dashboard
   */
  async getMonitoringMetrics(hours = 24): Promise<{
    uptime_percentage: number;
    avg_response_time_ms: number;
    total_checks: number;
    failed_checks: number;
    recent_alerts: any[];
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    try {
      // This would require a monitoring_logs table to track checks over time
      // For now, return basic metrics from current state
      const healthCheck = await this.performHealthCheck();
      
      return {
        uptime_percentage: healthCheck.litellm_reachable ? 100 : 0,
        avg_response_time_ms: healthCheck.response_time_ms || 0,
        total_checks: 1,
        failed_checks: healthCheck.litellm_reachable ? 0 : 1,
        recent_alerts: [] // Would come from system_alerts table
      };
    } catch (error) {
      console.error('Failed to get monitoring metrics:', error);
      return {
        uptime_percentage: 0,
        avg_response_time_ms: 0,
        total_checks: 0,
        failed_checks: 0,
        recent_alerts: []
      };
    }
  }

  /**
   * Auto-heal common issues
   */
  async attemptAutoHeal(): Promise<{
    attempted: boolean;
    actions: string[];
    success: boolean;
  }> {
    const actions: string[] = [];
    let success = false;

    try {
      // Check for keys stuck in pending status
      const { data: pendingKeys } = await this.supabase
        .from('virtual_keys')
        .select('id, key, last_synced_at')
        .eq('sync_status', 'pending')
        .lt('last_synced_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // 1 hour old

      if (pendingKeys && pendingKeys.length > 0) {
        actions.push(`Found ${pendingKeys.length} keys stuck in pending status`);
        
        // Attempt to re-sync stuck keys
        for (const key of pendingKeys.slice(0, 5)) { // Limit to 5 keys to avoid overload
          try {
            // This would call the sync API
            const response = await fetch(`${process.env.BASE_URL}/api/keys/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || 'internal'}`
              },
              body: JSON.stringify({
                keyId: key.id,
                action: 'update'
              })
            });

            if (response.ok) {
              actions.push(`Re-synced key ${key.key.substring(0, 12)}...`);
              success = true;
            }
          } catch (error) {
            actions.push(`Failed to re-sync key ${key.key.substring(0, 12)}...: ${error}`);
          }
        }
      }

      return {
        attempted: actions.length > 0,
        actions,
        success
      };
    } catch (error) {
      return {
        attempted: true,
        actions: [`Auto-heal failed: ${error}`],
        success: false
      };
    }
  }
}

// Export singleton instance
export const liteLLMMonitoring = new LiteLLMMonitoring();

// Export types for use in other modules
export type { HealthCheckResult, AlertThresholds };
