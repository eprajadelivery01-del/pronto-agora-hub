-- Migration: Security Hardening - Rate limits and RPC lockdown
BEGIN;

-- 1. Lock down create_order_v3 so anon cannot call it
REVOKE EXECUTE ON FUNCTION public.create_order_v3 FROM anon;
GRANT EXECUTE ON FUNCTION public.create_order_v3 TO authenticated;

-- 2. Create tables for IP tracking
CREATE TABLE IF NOT EXISTS public.ip_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  action text NOT NULL,
  user_id uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ip_action_logs ON public.ip_action_logs(ip_address, action, created_at);

CREATE TABLE IF NOT EXISTS public.blocked_ips_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  attempted_action text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Create generic IP Rate Limit function
CREATE OR REPLACE FUNCTION public.log_and_check_ip_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_client_ip text;
  v_recent_count int;
  v_limit int;
  v_time_window interval;
  v_action text;
BEGIN
  -- Extract IP from Supabase request headers
  v_client_ip := current_setting('request.headers', true)::json->>'x-real-ip';
  IF v_client_ip IS NULL THEN
    v_client_ip := 'unknown';
  END IF;

  -- Define rules per table
  IF TG_TABLE_NAME = 'companies' THEN
    v_limit := 2; v_time_window := interval '1 hour'; v_action := 'create_company';
  ELSIF TG_TABLE_NAME = 'delivery_drivers' THEN
    v_limit := 2; v_time_window := interval '1 day'; v_action := 'create_driver';
  ELSIF TG_TABLE_NAME = 'addresses' THEN
    v_limit := 10; v_time_window := interval '1 hour'; v_action := 'create_address';
  ELSIF TG_TABLE_NAME = 'orders' THEN
    v_limit := 5; v_time_window := interval '1 hour'; v_action := 'create_order';
  END IF;

  -- Count recent actions
  SELECT count(*) INTO v_recent_count 
  FROM public.ip_action_logs 
  WHERE ip_address = v_client_ip AND action = v_action AND created_at > now() - v_time_window;

  IF v_recent_count >= v_limit THEN
    -- Log the block and abort the insert
    INSERT INTO public.blocked_ips_log (ip_address, attempted_action) VALUES (v_client_ip, v_action || '_blocked');
    RAISE EXCEPTION 'Too many requests. Rate limit exceeded for %.', v_action;
  END IF;

  -- If passed, log the action
  INSERT INTO public.ip_action_logs (ip_address, action, user_id) VALUES (v_client_ip, v_action, auth.uid());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply triggers to vulnerable tables
DROP TRIGGER IF EXISTS tr_rate_limit_companies ON public.companies;
CREATE TRIGGER tr_rate_limit_companies
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.log_and_check_ip_rate_limit();

DROP TRIGGER IF EXISTS tr_rate_limit_drivers ON public.delivery_drivers;
CREATE TRIGGER tr_rate_limit_drivers
  BEFORE INSERT ON public.delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION public.log_and_check_ip_rate_limit();

DROP TRIGGER IF EXISTS tr_rate_limit_addresses ON public.addresses;
CREATE TRIGGER tr_rate_limit_addresses
  BEFORE INSERT ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.log_and_check_ip_rate_limit();

-- Remove the old manual shield_bot_by_ip if it exists, replace with this generic one
DROP TRIGGER IF EXISTS shield_bot_by_ip ON public.orders;
DROP TRIGGER IF EXISTS tr_rate_limit_orders ON public.orders;
CREATE TRIGGER tr_rate_limit_orders
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_and_check_ip_rate_limit();

COMMIT;
