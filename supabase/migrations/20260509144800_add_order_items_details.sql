-- =============================================
-- ADD NOTES AND OPTIONS TO ORDER_ITEMS
-- =============================================
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;
