-- Fix RLS policy to allow drivers to see broadcasted deliveries
DROP POLICY IF EXISTS "Drivers can view pending deliveries" ON public.deliveries;

CREATE POLICY "Drivers can view available deliveries" ON public.deliveries
  FOR SELECT USING (
    (status = 'pending' OR status = 'broadcasted') 
    AND public.has_role(auth.uid(), 'driver')
  );
