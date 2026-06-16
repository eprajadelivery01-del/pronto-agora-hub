-- Add is_featured column to products table for marketplace Destaques
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
