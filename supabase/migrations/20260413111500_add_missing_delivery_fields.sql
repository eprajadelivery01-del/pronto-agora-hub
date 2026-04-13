-- Migration: 20260413111500_add_missing_delivery_fields
-- Description: Add customer_phone and difficulty columns to deliveries table

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='customer_phone') THEN
    ALTER TABLE public.deliveries ADD COLUMN customer_phone TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='difficulty') THEN
    ALTER TABLE public.deliveries ADD COLUMN difficulty TEXT DEFAULT 'Padrão';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
