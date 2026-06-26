-- Fix anonymous access to companies and products after previous migrations dropped it
BEGIN;

GRANT SELECT ON public.companies TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;

DROP POLICY IF EXISTS "companies_select_anon" ON public.companies;
CREATE POLICY "companies_select_anon" ON public.companies FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "products_select_anon" ON public.products;
CREATE POLICY "products_select_anon" ON public.products FOR SELECT TO anon USING (true);

COMMIT;
