-- Migration: Add insert policy for reviews so customers can evaluate orders

BEGIN;

DROP POLICY IF EXISTS "Customers can insert reviews" ON public.reviews;

CREATE POLICY "Customers can insert reviews" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = reviews.order_id AND (orders.user_id = auth.uid() OR orders.customer_id = auth.uid())
    )
  );

COMMIT;
