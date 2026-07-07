-- Fix Reviews permissions and rating trigger
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

-- Allow users to update their own reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update reviews' AND tablename = 'reviews'
  ) THEN
    CREATE POLICY "Users can update reviews" ON public.reviews
      FOR UPDATE USING (auth.uid() = user_id);
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
