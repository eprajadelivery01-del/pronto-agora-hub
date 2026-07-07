-- Fix Reviews schema to match Marketplace expectations
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(user_id),
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS type TEXT;

ALTER TABLE public.reviews
  ALTER COLUMN delivery_id DROP NOT NULL,
  ALTER COLUMN driver_id DROP NOT NULL;

-- Allow users to insert their own reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert reviews' AND tablename = 'reviews'
  ) THEN
    CREATE POLICY "Users can insert reviews" ON public.reviews
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create function to update company rating automatically
CREATE OR REPLACE FUNCTION public.update_company_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating NUMERIC(3,2);
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    SELECT COALESCE(AVG(rating), 5.0)
    INTO avg_rating
    FROM public.reviews
    WHERE company_id = NEW.company_id;

    UPDATE public.companies
    SET rating = avg_rating
    WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_company_rating_trigger ON public.reviews;
CREATE TRIGGER update_company_rating_trigger
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_company_rating();
