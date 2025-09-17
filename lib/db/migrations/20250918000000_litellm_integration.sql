-- Add LiteLLM integration fields to virtual_keys table
ALTER TABLE virtual_keys 
ADD COLUMN litellm_key_id TEXT UNIQUE,
ADD COLUMN rpm_limit INTEGER,
ADD COLUMN tpm_limit INTEGER,
ADD COLUMN max_budget INTEGER, -- in cents
ADD COLUMN budget_duration TEXT, -- e.g., "30d", "1h"
ADD COLUMN model_restrictions TEXT, -- JSON array of allowed models
ADD COLUMN guardrails TEXT, -- JSON array of guardrail names
ADD COLUMN metadata TEXT, -- JSON object for additional data
ADD COLUMN last_synced_at TIMESTAMP,
ADD COLUMN sync_status VARCHAR(20) DEFAULT 'pending'; -- pending, synced, failed

-- Create usage_logs table for detailed analytics
CREATE TABLE usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    virtual_key_id UUID REFERENCES virtual_keys(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cache_read_input_tokens INTEGER DEFAULT 0,
    cache_creation_input_tokens INTEGER DEFAULT 0,
    cost_in_cents INTEGER NOT NULL,
    litellm_model_id TEXT,
    provider TEXT,
    request_duration_ms INTEGER,
    status VARCHAR(20) DEFAULT 'success', -- success, failed, error
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_virtual_key_id ON usage_logs(virtual_key_id);
CREATE INDEX idx_usage_logs_model ON usage_logs(model);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_status ON usage_logs(status);
CREATE INDEX idx_virtual_keys_litellm_key_id ON virtual_keys(litellm_key_id);
CREATE INDEX idx_virtual_keys_sync_status ON virtual_keys(sync_status);
CREATE INDEX idx_virtual_keys_last_synced_at ON virtual_keys(last_synced_at);

-- Update existing RPC functions to handle new fields
CREATE OR REPLACE FUNCTION add_credit(p_user_id uuid, p_credit_to_add integer)
  RETURNS void AS $$
    UPDATE virtual_keys
    SET credit_balance = credit_balance + p_credit_to_add,
        last_synced_at = NOW(),
        sync_status = 'pending'
    WHERE user_id = p_user_id;
  $$ LANGUAGE sql;

-- Create new RPC function for updating LiteLLM sync status
CREATE OR REPLACE FUNCTION update_litellm_sync_status(p_key_id text, p_status text, p_litellm_key_id text DEFAULT NULL)
  RETURNS void AS $$
    UPDATE virtual_keys
    SET sync_status = p_status,
        last_synced_at = NOW(),
        litellm_key_id = COALESCE(p_litellm_key_id, litellm_key_id)
    WHERE key = p_key_id;
  $$ LANGUAGE sql;

-- Create RPC function for logging usage
CREATE OR REPLACE FUNCTION log_usage(
    p_user_id uuid,
    p_virtual_key_id uuid,
    p_model text,
    p_prompt_tokens integer,
    p_completion_tokens integer,
    p_total_tokens integer,
    p_cost_in_cents integer,
    p_litellm_model_id text DEFAULT NULL,
    p_provider text DEFAULT NULL,
    p_request_duration_ms integer DEFAULT NULL,
    p_cache_read_input_tokens integer DEFAULT 0,
    p_cache_creation_input_tokens integer DEFAULT 0
)
RETURNS uuid AS $$
DECLARE
    log_id uuid;
BEGIN
    INSERT INTO usage_logs (
        user_id, virtual_key_id, model, prompt_tokens, completion_tokens,
        total_tokens, cost_in_cents, litellm_model_id, provider,
        request_duration_ms, cache_read_input_tokens, cache_creation_input_tokens
    ) VALUES (
        p_user_id, p_virtual_key_id, p_model, p_prompt_tokens, p_completion_tokens,
        p_total_tokens, p_cost_in_cents, p_litellm_model_id, p_provider,
        p_request_duration_ms, p_cache_read_input_tokens, p_cache_creation_input_tokens
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;
