-- Migration to add customer_cpf to deliveries
-- Date: 2026-04-13

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'customer_cpf') THEN
        ALTER TABLE public.deliveries ADD COLUMN customer_cpf TEXT;
    END IF;
END $$;

-- Update customers table RLS if needed (already handled by previous nuclear RLS, but just to be safe)
COMMENT ON COLUMN public.deliveries.customer_cpf IS 'CPF of the customer for easier identification and persistence';
