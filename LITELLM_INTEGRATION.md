# LiteLLM Integration Guide - Simplified Architecture

This document outlines the simplified LiteLLM integration that provides direct API key management without proxy complexity.

## Overview

The simplified integration provides:
- **Direct LiteLLM Access**: Users get LiteLLM API keys directly for their applications
- **Simple Key Management**: Create and manage LiteLLM keys through a clean dashboard
- **Payment Integration**: Purchase credits that fund LiteLLM key budgets
- **No Proxy Overhead**: Requests go directly to LiteLLM, reducing complexity and latency

## Architecture

### Simplified Flow
1. **User Signup**: Creates a placeholder database record
2. **Key Creation**: On-demand creation of LiteLLM keys via dashboard
3. **Direct Usage**: Users make requests directly to LiteLLM with their keys
4. **Budget Management**: Payment system funds LiteLLM key budgets

## Database Schema

### Simplified `virtual_keys` Table
```sql
-- Core fields for LiteLLM integration
- litellm_key_id TEXT UNIQUE           -- The actual LiteLLM API key
- max_budget INTEGER                   -- Budget in cents for LiteLLM key
- budget_duration TEXT                 -- e.g., "30d", "1h"
- rpm_limit INTEGER                    -- Requests per minute
- tpm_limit INTEGER                    -- Tokens per minute
- sync_status VARCHAR(20)              -- pending, synced, failed
- last_synced_at TIMESTAMP             -- Last sync with LiteLLM
```

Note: Complex analytics tables (`usage_logs`, `monitoring_logs`) are removed in the simplified version since users interact directly with LiteLLM.

## Environment Variables

Add these to your `.env` file:

```bash
# LiteLLM Configuration (Required)
LITELLM_BASE_URL=https://your-litellm.example.com
LITELLM_MASTER_KEY=your-litellm-master-key

# LiteLLM API Endpoints (Optional - will use base URL if not specified)
LITELLM_KEY_GENERATE_URL=https://your-litellm.example.com/key/generate
LITELLM_KEY_UPDATE_URL=https://your-litellm.example.com/key/update
```

## Key Features

### 1. Simple Key Management

**Dashboard Location:** `/analytics`

**Features:**
- Create LiteLLM API keys on-demand
- Copy keys for use in applications
- View key budgets and limits
- Direct link to LiteLLM base URL

### 2. Key Management API

**Endpoint:** `/api/keys/manage`

**Features:**
- `GET` - List user's LiteLLM keys
- `POST` - Create new LiteLLM keys
- Direct integration with LiteLLM API
- Automatic budget and rate limit setup

### 3. Payment Integration

**Features:**
- Purchase credits via Paystack
- Credits fund LiteLLM key budgets
- Automatic budget updates after payments

## User Flow

### 1. User Signup
- Creates profile in `profiles` table
- Creates placeholder record in `virtual_keys` table
- No LiteLLM key created yet (on-demand)

### 2. Key Creation
- User visits `/analytics` dashboard
- Clicks "Create New Key" button
- System calls LiteLLM API to generate key
- Key stored in `virtual_keys.litellm_key_id`
- User can copy key for their applications

### 3. Direct Usage
- Users make requests directly to LiteLLM
- No proxy layer or monitoring overhead
- LiteLLM handles rate limiting and budgets natively

## User Signup Flow

1. **Database Trigger**: `handle_new_user()` creates profile and virtual key
2. **Default Settings**: Sets reasonable defaults for new users:
   - 500 initial credits
   - $10 budget limit
   - 100 RPM, 10k TPM limits
   - 30-day budget cycle
3. **Sync Status**: Marked as 'pending' for later LiteLLM sync

## Payment Integration

Enhanced webhook (`payment-webhook/index.ts`):
1. **Credit Addition**: Add credits to user account
2. **Transaction Logging**: Record payment transaction
3. **LiteLLM Sync**: Automatically update LiteLLM budget limits
4. **Error Handling**: Graceful fallback if sync fails

## Error Handling & Fallbacks

### LiteLLM Unavailable
- **Key Management**: Falls back to local DB enforcement
- **Token Counting**: Uses header-based or flat-rate costing
- **Analytics**: Shows local data only
- **User Experience**: Transparent degradation with status indicators

### Sync Failures
- **Status Tracking**: `sync_status` field tracks sync state
- **Retry Logic**: Exponential backoff for API calls
- **Admin Visibility**: Dashboard shows sync failures
- **Manual Recovery**: Admin can manually trigger re-sync

## Monitoring & Observability

### Logging
- **Structured Logs**: All LiteLLM interactions logged
- **Error Tracking**: Failed syncs and API calls tracked
- **Performance Metrics**: Request duration tracking

### Dashboard Indicators
- **LiteLLM Status**: Shows if LiteLLM is configured/connected
- **Sync Status**: Per-key sync status with timestamps
- **Usage Trends**: Visual analytics for usage patterns

## Migration Guide

### For Existing Installations

1. **Run Migrations**:
   ```bash
   # Apply schema changes
   psql -f lib/db/migrations/20250918000000_litellm_integration.sql
   ```

2. **Update Environment**:
   ```bash
   # Add LiteLLM URLs to .env
   cp .env.example .env
   # Edit .env with your LiteLLM instance URLs
   ```

3. **Sync Existing Keys** (Optional):
   ```bash
   # Use the dashboard or API to sync existing keys
   curl -X POST /api/keys/sync -d '{"keyId": "key-id", "action": "create"}'
   ```

### For New Installations

1. **Set Environment Variables**: Configure LiteLLM URLs
2. **Deploy**: Standard deployment process
3. **Verify**: Check `/analytics` dashboard for LiteLLM status

## API Reference

### Key Sync API

```typescript
// Create key in LiteLLM
POST /api/keys/sync
{
  "keyId": "uuid",
  "action": "create"
}

// Update existing key
POST /api/keys/sync
{
  "keyId": "uuid", 
  "action": "update"
}

// Get sync status
GET /api/keys/sync
```

### Analytics API

```typescript
// Get usage analytics
GET /api/analytics/usage?start_date=2024-01-01&end_date=2024-01-31&model=gpt-4
```

## Performance Considerations

### Token Counting
- **Async Processing**: Token counting doesn't block response
- **Caching**: Consider implementing token count caching for repeated prompts
- **Fallbacks**: Multiple fallback strategies prevent blocking

### Database
- **Indexes**: Added for common query patterns
- **Partitioning**: Consider partitioning `usage_logs` by date for large volumes
- **Cleanup**: Implement log retention policies

### LiteLLM Integration
- **Rate Limiting**: Respect LiteLLM API limits
- **Connection Pooling**: Reuse connections where possible
- **Circuit Breaker**: Fail fast when LiteLLM is down

## Security Considerations

### API Keys
- **Secure Storage**: LiteLLM keys stored in environment variables
- **Rotation**: Plan for key rotation procedures
- **Scoping**: Use minimal required permissions

### Data Privacy
- **PII Handling**: Avoid logging sensitive prompt data
- **Retention**: Implement data retention policies
- **Access Control**: Restrict analytics access to authorized users

## Troubleshooting

### Common Issues

1. **LiteLLM Connection Failed**
   - Check environment variables
   - Verify LiteLLM instance is accessible
   - Check API key permissions

2. **Sync Status Stuck on 'pending'**
   - Check LiteLLM logs for errors
   - Manually trigger sync via dashboard
   - Verify key format and permissions

3. **Token Counting Inaccurate**
   - Check LiteLLM token counter endpoint
   - Verify model name matches LiteLLM config
   - Review fallback cost calculation

### Debug Mode

Enable detailed logging:
```bash
# In Edge Function environment
INCLUDE_COST_HEADERS=true
LOG_LEVEL=debug
```

## Future Enhancements

### Planned Features
- **Real-time Sync**: WebSocket-based real-time sync updates
- **Advanced Analytics**: More detailed cost optimization insights
- **Bulk Operations**: Bulk key management operations
- **Alerting**: Budget and usage threshold alerts

### Integration Opportunities
- **Slack Notifications**: Budget alerts and usage reports
- **Prometheus Metrics**: Export metrics for monitoring
- **Audit Logging**: Enhanced audit trail for compliance

## Support

For issues related to this integration:
1. Check the dashboard `/analytics` for system status
2. Review logs in Supabase Edge Functions
3. Verify LiteLLM instance health
4. Check environment variable configuration

The integration is designed to be resilient and will fall back to local-only operation if LiteLLM is unavailable, ensuring your service remains operational.


Imprvemnt Prompt:
In this repo  I have a litellm integration feature, that makes a key part of the app. 

 lib/litellm/client.ts:1-376
```
/**
 * LiteLLM API client for key management, token counting, and analytics
 */

export interface LiteLLMKeyGenerateRequest {
  user_id?: string;
  key_alias?: string;
  max_budget?: number; 
  budget_duration?: string; 
  models?: string[];
  rpm_limit?: number;
  tpm_limit?: number;
  metadata?: Record<string, any>;
  guardrails?: string[];
  duration?: string; 
}

export interface LiteLLMKeyGenerateResponse {
  key: string;
  expires?: string;
  user_id?: string;
}

export interface LiteLLMKeyUpdateRequest {
  key: string;
  max_budget?: number;
  spend?: number;
  rpm_limit?: number;
  tpm_limit?: number;
  metadata?: Record<string, any>;
  blocked?: boolean;
  models?: string[];
  guardrails?: string[];
}

export interface LiteLLMTokenCountRequest {
  model: string;
  prompt?: string;
  messages?: any[];
  contents?: any[];
}

export interface LiteLLMTokenCountResponse {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface LiteLLMSpendDailyRequest {
  start_date?: string; 
  end_date?: string; 
  model?: string;
  api_key?: string;
  page?: number;
  page_size?: number;
}

export interface LiteLLMSpendDailyResponse {
  results: Array<{
    date: string;
    metrics: {
      spend: number;
      prompt_tokens: number;
      completion_tokens: number;
      cache_read_input_tokens: number;
      cache_creation_input_tokens: number;
      total_tokens: number;
      successful_requests: number;
      failed_requests: number;
      api_requests: number;
    };
    breakdown: {
      models: Record<string, any>;
      api_keys: Record<string, any>;
      providers: Record<string, any>;
    };
  }>;
  metadata: {
    total_spend: number;
    total_tokens: number;
    page: number;
    total_pages: number;
    has_more: boolean;
  };
}

class LiteLLMClient {
  private baseUrl: string;
  private masterKey: string;
  private keyGenerateUrl: string;
  private keyUpdateUrl: string;
  private tokenCounterUrl: string;
  private spendDailyUrl: string;
  private modelsUrl: string;
  private supportedParamsUrl: string;
  private customerNewUrl: string;
  private customerInfoUrl: string;
  private userDailyActivityUrl: string;
  private userDailyActivityAggregatedUrl: string;

  constructor() {
    this.baseUrl = process.env.LITELLM_BASE_URL || '';
    this.masterKey = process.env.LITELLM_MASTER_KEY || '';
    this.keyGenerateUrl = process.env.LITELLM_KEY_GENERATE_URL || `${this.baseUrl}/key/generate`;
    this.keyUpdateUrl = process.env.LITELLM_KEY_UPDATE_URL || `${this.baseUrl}/key/update`;
    this.tokenCounterUrl = process.env.LITELLM_TOKEN_COUNTER_URL || `${this.baseUrl}/utils/token_counter`;
    this.spendDailyUrl = process.env.LITELLM_SPEND_DAILY_URL || `${this.baseUrl}/spend/daily`;
    this.modelsUrl = process.env.LITELLM_MODELS_URL || `${this.baseUrl}/models`;
    this.supportedParamsUrl = process.env.LITELLM_SUPPORTED_PARAMS_URL || `${this.baseUrl}/utils/supported_openai_params`;
    this.customerNewUrl = process.env.LITELLM_CUSTOMER_NEW_URL || `${this.baseUrl}/customer/new`;
    this.customerInfoUrl = process.env.LITELLM_CUSTOMER_INFO_URL || `${this.baseUrl}/customer/info`;
    this.userDailyActivityUrl = process.env.LITELLM_USER_DAILY_ACTIVITY_URL || `${this.baseUrl}/user/daily/activity`;
    this.userDailyActivityAggregatedUrl = process.env.LITELLM_USER_DAILY_ACTIVITY_AGG_URL || `${this.baseUrl}/user/daily/activity/aggregated`;

    if (!this.baseUrl || !this.masterKey) {
      console.warn('LiteLLM configuration missing. Some features may not work.');
    }
  }

  async getModels(litellm_model_id?: string): Promise<any> {
    const url = litellm_model_id
      ? `${this.modelsUrl}?litellm_model_id=${encodeURIComponent(litellm_model_id)}`
      : this.modelsUrl;
    return this.makeRequest<any>(url);
  }

  async getSupportedOpenAIParams(model: string): Promise<any> {
    const url = `${this.supportedParamsUrl}?model=${encodeURIComponent(model)}`;
    return this.makeRequest<any>(url);
  }

  private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const timeoutMs = Number(process.env.LITELLM_TIMEOUT_MS || 2500);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.masterKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LiteLLM API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async generateKey(request: LiteLLMKeyGenerateRequest): Promise<LiteLLMKeyGenerateResponse> {
    return this.makeRequest<LiteLLMKeyGenerateResponse>(this.keyGenerateUrl, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updateKey(request: LiteLLMKeyUpdateRequest): Promise<void> {
    await this.makeRequest(this.keyUpdateUrl, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async countTokens(request: LiteLLMTokenCountRequest, callEndpoint = false): Promise<LiteLLMTokenCountResponse> {
    const url = `${this.tokenCounterUrl}?call_endpoint=${callEndpoint}`;
    return this.makeRequest<LiteLLMTokenCountResponse>(url, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getSpendDaily(request: LiteLLMSpendDailyRequest = {}): Promise<LiteLLMSpendDailyResponse> {
    const params = new URLSearchParams();
    if (request.start_date) params.append('start_date', request.start_date);
    if (request.end_date) params.append('end_date', request.end_date);
    if (request.model) params.append('model', request.model);
    if (request.api_key) params.append('api_key', request.api_key);
    if (request.page) params.append('page', request.page.toString());
    if (request.page_size) params.append('page_size', request.page_size.toString());

    const url = `${this.spendDailyUrl}?${params.toString()}`;
    return this.makeRequest<LiteLLMSpendDailyResponse>(url);
  }

  async createCustomer(request: LiteLLMCustomerCreateRequest): Promise<LiteLLMCustomerCreateResponse> {
    return this.makeRequest<LiteLLMCustomerCreateResponse>(this.customerNewUrl, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getCustomerInfo(endUserId: string): Promise<LiteLLMCustomerInfoResponse> {
    const url = `${this.customerInfoUrl}?end_user_id=${encodeURIComponent(endUserId)}`;
    return this.makeRequest<LiteLLMCustomerInfoResponse>(url);
  }

  async getUserDailyActivity(request: LiteLLMUserDailyActivityRequest = {}): Promise<LiteLLMUserDailyActivityResponse> {
    const params = new URLSearchParams();
    if (request.start_date) params.append('start_date', request.start_date);
    if (request.end_date) params.append('end_date', request.end_date);
    if (request.model) params.append('model', request.model);
    if (request.api_key) params.append('api_key', request.api_key);

    const url = `${this.userDailyActivityUrl}?${params.toString()}`;
    return this.makeRequest<LiteLLMUserDailyActivityResponse>(url);
  }

  async getUserDailyActivityAggregated(request: LiteLLMUserDailyActivityRequest = {}): Promise<LiteLLMUserDailyActivityResponse> {
    const params = new URLSearchParams();
    if (request.start_date) params.append('start_date', request.start_date);
    if (request.end_date) params.append('end_date', request.end_date);
    if (request.model) params.append('model', request.model);
    if (request.api_key) params.append('api_key', request.api_key);

    const url = `${this.userDailyActivityAggregatedUrl}?${params.toString()}`;
    return this.makeRequest<LiteLLMUserDailyActivityResponse>(url);
  }

  
  isConfigured(): boolean {
    return !!(this.baseUrl && this.masterKey);
  }

  
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`LiteLLM operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}


export const liteLLMClient = new LiteLLMClient();


export class LiteLLMError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'LiteLLMError';
  }
}

export interface LiteLLMCustomerCreateRequest {
  user_id: string;
  alias?: string;
  blocked?: boolean;
  max_budget?: number;
  budget_id?: string;
  allowed_model_region?: 'eu' | 'us';
  default_model?: string;
  metadata?: Record<string, any>;
  budget_duration?: string;
  tpm_limit?: number;
  rpm_limit?: number;
  model_max_budget?: Record<string, any>;
  max_parallel_requests?: number;
  soft_budget?: number;
  spend?: number;
  budget_reset_at?: string;
}

export interface LiteLLMCustomerCreateResponse {
  user_id: string;
  blocked: boolean;
  alias?: string;
  spend: number;
  allowed_model_region?: 'eu' | 'us';
  default_model?: string;
  litellm_budget_table?: {
    budget_id?: string;
    soft_budget?: number;
    max_budget?: number;
    max_parallel_requests?: number;
    tpm_limit?: number;
    rpm_limit?: number;
    model_max_budget?: Record<string, any>;
    budget_duration?: string;
  };
}

export interface LiteLLMCustomerInfoResponse {
  user_id: string;
  blocked: boolean;
  alias?: string;
  spend: number;
  allowed_model_region?: 'eu' | 'us';
  default_model?: string;
  litellm_budget_table: {
    budget_id?: string;
    soft_budget?: number;
    max_budget?: number;
    max_parallel_requests?: number;
    tpm_limit?: number;
    rpm_limit?: number;
    model_max_budget?: Record<string, any>;
    budget_duration?: string;
    budget_reset_at?: string;
  };
}

export interface LiteLLMUserDailyActivityRequest {
  start_date?: string; // YYYY-MM-DD format
  end_date?: string; // YYYY-MM-DD format
  model?: string;
  api_key?: string;
}

export interface LiteLLMUserDailyActivityResponse {
  [date: string]: {
    spend: number;
    prompt_tokens: number;
    completion_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
    total_tokens: number;
    api_requests: number;
    models: {
      [model: string]: {
        spend: number;
        prompt_tokens: number;
        completion_tokens: number;
        cache_read_input_tokens: number;
        cache_creation_input_tokens: number;
        total_tokens: number;
        api_requests: number;
      };
    };
    api_keys: {
      [api_key: string]: {
        spend: number;
        prompt_tokens: number;
        completion_tokens: number;
        cache_read_input_tokens: number;
        cache_creation_input_tokens: number;
        total_tokens: number;
        api_requests: number;
      };
    };
    providers: {
      [provider: string]: {
        spend: number;
        prompt_tokens: number;
        completion_tokens: number;
        cache_read_input_tokens: number;
        cache_creation_input_tokens: number;
        total_tokens: number;
        api_requests: number;
      };
    };
  };
}

``` app/api/keys/sync/route.ts:1-191
```
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
        const litellmResponse = await liteLLMClient.withRetry(() =>
          liteLLMClient.generateKey({
            user_id: user.id.toString(),
            key_alias: `user-${user.id}-${virtualKey.id}`,
            max_budget: virtualKey.max_budget ? virtualKey.max_budget / 100 : undefined, 
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

```


 app/api/keys/sync-spend/route.ts:1-144
```
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { getServerSupabase } from '@/lib/supabase/nextServer';
import { liteLLMClient } from '@/lib/litellm/client';

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Sync spend from LiteLLM for active keys and adjust local credit.
 * Listener mode: users call LiteLLM directly; we reconcile balances here.
 * - Stores progress in virtual_keys.metadata as JSON:
 *   { litellm_spend_synced_cents: number, last_spend_sync_at: string }
 */
export async function POST() {
  try {
    if (!liteLLMClient.isConfigured()) {
      return NextResponse.json({ error: 'LiteLLM not configured' }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: keys, error } = await supabaseAdmin
      .from('virtual_keys')
      .select('id, key, litellm_key_id, is_active, metadata')
      .eq('user_id', authUser.user.id)
      .eq('is_active', true);
    if (error) throw error;
    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: 'No active keys' }, { status: 400 });
    }

    const results: any[] = [];

    // Helper to format YYYY-MM-DD
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    for (const k of keys) {
      if (!k.litellm_key_id) continue;
      // Determine date range: since last sync day or last 30 days
      let startDate: string;
      const today = new Date();
      const endDate = fmt(today);
      try {
        const meta = k.metadata ? JSON.parse(k.metadata) : {};
        if (typeof meta.last_spend_sync_day === 'string') {
          startDate = meta.last_spend_sync_day;
        } else {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          startDate = fmt(d);
        }
      } catch {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = fmt(d);
      }

      // Pull aggregated spend for this API key within the window
      let daily: any = null;
      try {
        daily = await liteLLMClient.withRetry(
          () => liteLLMClient.getUserDailyActivityAggregated({
            api_key: k.litellm_key_id!,
            start_date: startDate,
            end_date: endDate,
          }),
          1,
          400
        );
      } catch (e) {
        results.push({ key_id: k.id, period_start: startDate, period_end: endDate, error: (e as Error).message });
        continue;
      }

      // Iterate days and write usage log per non-zero spend day
      let totalDeltaCents = 0;
      const entries = Object.entries(daily as Record<string, any>)
        .filter(([day]) => day >= startDate && day <= endDate)
        .sort(([a], [b]) => a.localeCompare(b));

      for (const [day, info] of entries) {
        const spendDollars = Number((info as any)?.spend || 0);
        const cents = Math.max(0, Math.round(spendDollars * 100));
        if (cents <= 0) continue;

        // Decrement and log for this day
        const { data: logId, error: rpcErr } = await supabaseAdmin.rpc('log_usage_and_decrement', {
          p_user_id: authUser.user.id,
          p_virtual_key_id: k.id,
          p_model: 'litellm-rollup',
          p_prompt_tokens: 0,
          p_completion_tokens: 0,
          p_total_tokens: 0,
          p_cost_in_cents: cents,
          p_litellm_model_id: null,
          p_provider: 'litellm',
          p_request_duration_ms: 0,
          p_key: k.key
        });
        if (rpcErr) throw rpcErr;

        // Set created_at to the day for accurate analytics grouping
        if (logId) {
          const dayIso = `${day}T00:00:00Z`;
          await supabaseAdmin
            .from('usage_logs')
            .update({ created_at: dayIso })
            .eq('id', logId as string);
        }

        totalDeltaCents += cents;
      }

      // Only advance last_spend_sync_day if we had a successful fetch
      const meta = k.metadata ? (() => { try { return JSON.parse(k.metadata); } catch { return {}; } })() : {};
      meta.last_spend_sync_day = endDate;
      meta.last_spend_sync_at = new Date().toISOString();
      await supabaseAdmin
        .from('virtual_keys')
        .update({ metadata: JSON.stringify(meta) })
        .eq('id', k.id);

      results.push({ key_id: k.id, period_start: startDate, period_end: endDate, synced_delta_cents: totalDeltaCents });
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error('[sync-spend] error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

```


Now I also have a supabase function that handles litellm workloads here:
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Use environment variables set in the Supabase dashboard.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const LITELLM_MASTER_KEY = Deno.env.get('LITELLM_MASTER_KEY');
const LITELLM_BASE_URL = Deno.env.get('LITELLM_BASE_URL');
const LITELLM_TOKEN_COUNTER_URL = Deno.env.get('LITELLM_TOKEN_COUNTER_URL') || `${LITELLM_BASE_URL}/utils/token_counter`;
// Utility function to call LiteLLM token counter with retry
async function countTokens(request, retries = 2) {
  for(let attempt = 0; attempt <= retries; attempt++){
    try {
      const response = await fetch(LITELLM_TOKEN_COUNTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
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
      await new Promise((resolve)=>setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  return null;
}
serve(async (req)=>{
  const url = new URL(req.url);
  const path = url.pathname;
  // Extract virtual key from Authorization header
  const virtualKey = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!virtualKey) {
    return new Response(JSON.stringify({
      error: 'Missing API key'
    }), {
      status: 401
    });
  }
  // If this is a direct API call (not a passthrough), extract the request body
  let requestBody = null;
  let endpoint = '/v1/chat/completions'; // default
  if (path.startsWith('/v1/')) {
    // This is a direct API call like /v1/chat/completions
    endpoint = path;
    requestBody = await req.json().catch(()=>null);
  } else {
    // This is the original proxy format
    requestBody = await req.json();
    endpoint = requestBody?.messages ? '/v1/chat/completions' : '/v1/completions';
  }
  if (!requestBody) {
    return new Response(JSON.stringify({
      error: 'Missing request body'
    }), {
      status: 400
    });
  }
  // 2. Authenticate the virtual key and check credit
  const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const { data: keyData, error: keyError } = await supabaseAdmin.from('virtual_keys').select('id, user_id, credit_balance, is_active, litellm_key_id, rpm_limit, tpm_limit, model_restrictions').eq('key', virtualKey).single();
  if (keyError || !keyData) {
    return new Response(JSON.stringify({
      error: 'Invalid API key'
    }), {
      status: 403
    });
  }
  if (!keyData.is_active || keyData.credit_balance <= 0) {
    return new Response(JSON.stringify({
      error: 'Insufficient credit or inactive key'
    }), {
      status: 402
    }) // 402 Payment Required
    ;
  }
  // 3. Check model restrictions if configured
  const modelRestrictions = keyData.model_restrictions ? JSON.parse(keyData.model_restrictions) : null;
  const requestedModel = requestBody?.model;
  if (modelRestrictions && requestedModel && !modelRestrictions.includes(requestedModel)) {
    return new Response(JSON.stringify({
      error: `Model '${requestedModel}' not allowed for this key`
    }), {
      status: 403
    });
  }
  const startTime = Date.now();
  let tokenCountData = null;
  let usageLogId = null;
  try {
    let endpoint;
    if (path.startsWith('/v1/')) {
      endpoint = path;
    } else {
      endpoint = requestBody?.messages ? '/v1/chat/completions' : '/v1/completions';
    }
    const url = `${LITELLM_BASE_URL}${endpoint}`;
    const authHeader = `Bearer ${keyData.litellm_key_id}`;
    const llmRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(requestBody)
    });
    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error('LiteLLM error:', llmRes.status, errText);
      await supabaseAdmin.rpc('log_usage', {
        p_user_id: keyData.user_id,
        p_virtual_key_id: keyData.id,
        p_model: requestedModel || 'unknown',
        p_prompt_tokens: 0,
        p_completion_tokens: 0,
        p_total_tokens: 0,
        p_cost_in_cents: 0,
        p_request_duration_ms: Date.now() - startTime
      }).then(({ data })=>{
        if (data) usageLogId = data;
      });
      return new Response(JSON.stringify({
        error: 'LLM upstream error'
      }), {
        status: 502
      });
    }
    const responseJson = await llmRes.json();
    const requestDuration = Date.now() - startTime;
    if (requestedModel) {
      const tokenRequest = {
        model: requestedModel,
        ...requestBody?.messages ? {
          messages: requestBody.messages
        } : {
          prompt: requestBody?.prompt || ''
        }
      };
      tokenCountData = await countTokens(tokenRequest);
    }
    const headerCost = llmRes.headers.get('x-litellm-cost') || llmRes.headers.get('x-request-cost');
    let costInCents = 0;
    if (headerCost) {
      const numeric = Number(headerCost);
      if (!Number.isNaN(numeric)) {
        costInCents = Math.ceil(numeric * 100);
      }
    } else if (tokenCountData) {
      // Fallback: estimate cost based on token count (rough estimate: $0.01 per 1000 tokens)
      costInCents = Math.max(1, Math.ceil(tokenCountData.total_tokens * 0.00001 * 100));
    } else {
      // Final fallback: minimal flat cost
      costInCents = 1;
    }
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
      return new Response(JSON.stringify({
        error: 'Failed to commit usage and credit deduction'
      }), {
        status: 500
      });
    }
    if (logId) usageLogId = logId;
    // 9. Return the LLM's response to the user with optional cost info
    const responseHeaders = {
      'Content-Type': 'application/json'
    };
    // Optionally include cost information in headers (can be disabled for production)
    if (Deno.env.get('INCLUDE_COST_HEADERS') === 'true') {
      responseHeaders['X-Request-Cost-Cents'] = costInCents.toString();
      if (tokenCountData) {
        responseHeaders['X-Token-Count'] = tokenCountData.total_tokens.toString();
      }
    }
    return new Response(JSON.stringify(responseJson), {
      headers: responseHeaders,
      status: 200
    });
  } catch (error) {
    console.error('Proxy Error:', error);
    // Update usage log with error if we have one
    if (usageLogId) {
      await supabaseAdmin.from('usage_logs').update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        request_duration_ms: Date.now() - startTime
      }).eq('id', usageLogId);
    }
    return new Response(JSON.stringify({
      error: 'Failed to process LLM request'
    }), {
      status: 500
    });
  }
});


There is a lot of duplication, And the primay purpose here is just the following

Provisioning an api key with a 2 usd budget on sign up (already done)

Updating key budget when a user pays (3 plans, 5 15 and 20 usd)
Updating credited money on the dashboard with twice the budget on key users pays 5 we update key budget to 10 (works paritally but  does not actually increment on the proxy)

And calculating usage budget and 
decrementing credits on the dashboard while showing savings.

I want us to first 

Map out the requriemnents 
Make an assessment of what we have including the supabase function
deduplicate functionlaity

Have a minimal setup that just handles the budgets, I would prefere just listening on the requests instead of fully gating them (This causes a  alot of latency )

I want the user to just hit the proxy url.




