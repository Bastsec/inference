CREATE OR REPLACE FUNCTION decrement_credit(key_id text, amount integer)
  RETURNS void AS $$
    UPDATE virtual_keys
    SET credit_balance = credit_balance - amount
    WHERE key = key_id;
  $$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION add_credit(p_user_id uuid, p_credit_to_add integer)
  RETURNS void AS $$
    UPDATE virtual_keys
    SET credit_balance = credit_balance + p_credit_to_add
    WHERE user_id = p_user_id;
  $$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create a profile for the new user
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);

  -- Create a placeholder virtual key record (LiteLLM key will be created on-demand)
  INSERT INTO public.virtual_keys (
    user_id, 
    key, 
    credit_balance, 
    is_active,
    max_budget,
    budget_duration,
    rpm_limit,
    tpm_limit,
    sync_status
  )
  VALUES (
    new.id, 
    'placeholder-' || substr(md5(random()::text), 0, 25), 
    200, -- $2.00 initial credit for new users
    true,
    200, -- $2.00 initial budget in cents (will be increased after payment)
    '30d', -- 30 day budget cycle
    100,   -- 100 requests per minute default
    10000, -- 10k tokens per minute default
    'pending' -- LiteLLM key will be created when user requests it
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- trigger the function every time a user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
