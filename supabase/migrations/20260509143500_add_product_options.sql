-- =============================================
-- PRODUCT OPTION GROUPS
-- =============================================
CREATE TABLE public.product_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  min_options INTEGER NOT NULL DEFAULT 0,
  max_options INTEGER NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PRODUCT OPTIONS
-- =============================================
CREATE TABLE public.product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.product_option_groups(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER update_option_groups_updated_at
  BEFORE UPDATE ON public.product_option_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_options_updated_at
  BEFORE UPDATE ON public.product_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Groups
CREATE POLICY "Anyone can view product option groups" ON public.product_option_groups
  FOR SELECT USING (true);

CREATE POLICY "Company owners can manage groups" ON public.product_option_groups
  FOR ALL USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

-- Options
CREATE POLICY "Anyone can view product options" ON public.product_options
  FOR SELECT USING (true);

CREATE POLICY "Company owners can manage options" ON public.product_options
  FOR ALL USING (
    group_id IN (
      SELECT id FROM public.product_option_groups
      WHERE product_id IN (
        SELECT id FROM public.products 
        WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
      )
    )
  );
