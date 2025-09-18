-- Atomically log usage and decrement credit
-- Ensures no successful usage log remains without a corresponding credit deduction

CREATE OR REPLACE FUNCTION public.log_usage_and_decrement(
  p_user_id uuid,
  p_virtual_key_id uuid,
  p_model text,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_total_tokens integer,
  p_cost_in_cents integer,
  p_litellm_model_id text,
  p_provider text,
  p_request_duration_ms integer,
  p_key text
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  -- Insert usage log first
  INSERT INTO public.usage_logs (
    user_id,
    virtual_key_id,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    cost_in_cents,
    litellm_model_id,
    provider,
    request_duration_ms,
    status,
    created_at
  ) VALUES (
    p_user_id,
    p_virtual_key_id,
    p_model,
    COALESCE(p_prompt_tokens, 0),
    COALESCE(p_completion_tokens, 0),
    COALESCE(p_total_tokens, 0),
    COALESCE(p_cost_in_cents, 0),
    p_litellm_model_id,
    p_provider,
    COALESCE(p_request_duration_ms, 0),
    'success',
    NOW()
  ) RETURNING id INTO v_log_id;

  -- Decrement credit; also ensure sufficient balance
  UPDATE public.virtual_keys
  SET credit_balance = credit_balance - p_cost_in_cents
  WHERE key = p_key
    AND credit_balance >= p_cost_in_cents;

  IF NOT FOUND THEN
    -- Mark the usage log as voided/failed
    UPDATE public.usage_logs
    SET status = 'voided',
        error_message = 'Credit decrement failed (insufficient balance or key not found)',
        request_duration_ms = COALESCE(p_request_duration_ms, 0)
    WHERE id = v_log_id;

    RAISE EXCEPTION 'CREDIT_DECREMENT_FAILED';
  END IF;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
