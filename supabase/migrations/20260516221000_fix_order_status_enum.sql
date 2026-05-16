
-- Migration: 20260516221000_fix_order_status_enum
-- Description: Adds missing statuses to order_status enum to prevent 500/400 errors 
-- when updating or querying orders in 'in_route' or 'shipped' states.

-- Since we can't easily add values to an enum inside a transaction in some Postgres versions,
-- we'll use a safe approach.
COMMIT;

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_route';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'shipped';

BEGIN;
-- Any other fixes that need transaction...
COMMIT;

NOTIFY pgrst, 'reload schema';
