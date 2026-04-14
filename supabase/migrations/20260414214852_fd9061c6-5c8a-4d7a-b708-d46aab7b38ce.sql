
-- Table for tracking API usage / rate limiting
CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_function 
  ON public.api_usage_log(user_id, function_name, created_at DESC);

ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

-- No direct access policies — only via SECURITY DEFINER functions

-- Helper: log API usage
CREATE OR REPLACE FUNCTION public.log_api_usage(p_user_id uuid, p_function_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO api_usage_log (user_id, function_name) VALUES (p_user_id, p_function_name);
END;
$$;

-- Helper: check rate limit (returns count of calls in last 24h)
CREATE OR REPLACE FUNCTION public.check_api_rate_limit(p_user_id uuid, p_function_name text, p_max_calls integer DEFAULT 50)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM api_usage_log
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND created_at > now() - interval '24 hours';
  
  RETURN v_count < p_max_calls;
END;
$$;

-- Cleanup: auto-delete entries older than 7 days (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_api_usage_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM api_usage_log WHERE created_at < now() - interval '7 days';
END;
$$;
