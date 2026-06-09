-- Add sort_order column to products table for manual ordering
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill sort_order with epoch ms of created_at for existing rows
UPDATE public.products
SET sort_order = EXTRACT(EPOCH FROM created_at)::INTEGER
WHERE sort_order = 0;

-- Index for fast ordered queries per company + category
CREATE INDEX IF NOT EXISTS idx_products_company_category_sort
  ON public.products (company_id, category, sort_order ASC);
