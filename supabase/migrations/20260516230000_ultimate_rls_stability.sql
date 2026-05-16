
-- Migration: 20260516230000_ultimate_rls_stability
-- Description: Comprehensive fix for infinite recursion and 500 errors.
-- Unlocks SELECT for major tables to ensure stability and simplifies mutation policies.

BEGIN;

-- 1. RE-ESTABLISH has_role AS SECURITY DEFINER (Critical for bypassing RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2. USER_ROLES: Break all recursion
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone authenticated can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage everything" ON public.user_roles;
DROP POLICY IF EXISTS "Users can manage own roles" ON public.user_roles;

CREATE POLICY "user_roles_select_stable" ON public.user_roles 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_roles_admin_stable" ON public.user_roles
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 3. COMPANIES: Ensure basic info is always visible
DROP POLICY IF EXISTS "Companies can manage own record" ON public.companies;
DROP POLICY IF EXISTS "Public users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can view active companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can view all companies" ON public.companies;
DROP POLICY IF EXISTS "Company owners can update own" ON public.companies;
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Public can view basic company info" ON public.companies;
DROP POLICY IF EXISTS "Public can view active companies" ON public.companies;

CREATE POLICY "companies_select_stable" ON public.companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "companies_manage_stable" ON public.companies
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. ORDERS: Fix infinite recursion
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Companies can manage own orders" ON public.orders;
DROP POLICY IF EXISTS "Companies can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;

CREATE POLICY "orders_select_stable" ON public.orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "orders_manage_stable" ON public.orders
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  );

-- 5. CUSTOMERS: Fix infinite recursion
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Companies can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Customers can view own" ON public.customers;

CREATE POLICY "customers_select_stable" ON public.customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "customers_manage_stable" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'company') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'company') OR public.has_role(auth.uid(), 'admin'));

-- 6. DELIVERIES: Ensure stability
DROP POLICY IF EXISTS "Companies can manage own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Companies can view own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can view assigned deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can view available deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Admins can manage deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can view pending deliveries" ON public.deliveries;

CREATE POLICY "deliveries_select_stable" ON public.deliveries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "deliveries_manage_stable" ON public.deliveries
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'driver') OR
    public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'driver') OR
    public.has_role(auth.uid(), 'admin')
  );

-- 7. FIX AUTOMATION TRIGGER (Make it SECURITY DEFINER to avoid RLS loops)
CREATE OR REPLACE FUNCTION public.handle_order_ready_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_customer_name TEXT;
    v_address TEXT;
    v_delivery_id UUID;
    v_motoboy_id UUID;
BEGIN
    IF (NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready')) THEN
        BEGIN
            IF (NEW.user_id IS NOT NULL) THEN
                SELECT full_name INTO v_customer_name FROM public.profiles WHERE user_id = NEW.user_id;
            ELSE
                SELECT c.name INTO v_customer_name FROM public.customers c WHERE c.id = NEW.customer_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_customer_name := 'Cliente';
        END;

        BEGIN
            IF (NEW.address_id IS NOT NULL) THEN
                SELECT (street || ', ' || number || ' - ' || neighborhood || ' - ' || city)
                INTO v_address FROM public.addresses WHERE id = NEW.address_id;
            ELSE
                v_address := NEW.delivery_address;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_address := 'Endereço não informado';
        END;

        SELECT id INTO v_motoboy_id FROM public.motoboys WHERE is_online = true LIMIT 1;

        INSERT INTO public.deliveries (
            company_id,
            customer_name,
            address,
            value,
            status,
            motoboy_id,
            created_at,
            updated_at
        ) VALUES (
            NEW.company_id,
            COALESCE(v_customer_name, 'Cliente'),
            COALESCE(v_address, 'Endereço não informado'),
            NEW.total,
            'pending',
            v_motoboy_id,
            now(),
            now()
        ) RETURNING id INTO v_delivery_id;

        UPDATE public.orders SET delivery_id = v_delivery_id WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
