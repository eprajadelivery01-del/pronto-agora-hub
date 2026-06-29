-- 1. Cria a função que permite ao frontend descobrir quem é a verdadeira administradora
CREATE OR REPLACE FUNCTION get_davinyn_admin_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Busca pelo e-mail contendo davinyn em auth.users (Tabela segura do Supabase)
  SELECT id INTO v_id FROM auth.users WHERE email ILIKE '%davinyn%' LIMIT 1;
  RETURN v_id;
END;
$$;

-- 2. Concede permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION get_davinyn_admin_id() TO authenticated;

-- 3. Garante que ela está na tabela user_roles corretamente
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email ILIKE '%davinyn%' LIMIT 1;
  
  IF v_id IS NOT NULL THEN
    -- Insere ou atualiza o cargo para admin
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (v_id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
  END IF;
END $$;
