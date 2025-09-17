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
