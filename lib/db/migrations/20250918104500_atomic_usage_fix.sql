-- Update atomic RPC to strictly all-or-nothing semantics
-- If credit decrement fails, the entire transaction (including usage insert) rolls back

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
  v_rows_updated integer;
BEGIN
  -- Insert usage log
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

  -- Decrement credit; ensure sufficient balance
  UPDATE public.virtual_keys
  SET credit_balance = credit_balance - p_cost_in_cents
  WHERE key = p_key
    AND credit_balance >= p_cost_in_cents;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    -- Not enough credit or key mismatch -> abort whole transaction
    RAISE EXCEPTION 'CREDIT_DECREMENT_FAILED';
  END IF;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
