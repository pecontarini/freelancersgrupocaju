-- 1. Ampliar tabela tenants com branding completo
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS copy JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_dark_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_symbol_url TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- 2. Backfill do tenant caju com os valores atuais do src/tenants/caju/index.ts
UPDATE public.tenants
SET
  theme = jsonb_build_object(
    'primary', '20 74% 48%',
    'primaryStrong', '20 80% 40%',
    'accent', '20 74% 48%'
  ),
  copy = jsonb_build_object(
    'appName', 'Portal da Liderança',
    'tagline', 'Grupo Caju',
    'browserTitle', 'Portal da Liderança · Grupo Caju',
    'metaDescription', 'Portal de gestão operacional do Grupo Caju: escalas, freelancers, checklists, CMV, metas e indicadores.',
    'terms', jsonb_build_object('unit','unidade','unitPlural','unidades','group','grupo'),
    'strings', jsonb_build_object('welcome','Bem-vindo ao Portal da Liderança')
  ),
  primary_color = '#D55A1E',
  favicon_url = COALESCE(favicon_url, '/favicon-cajupar.png')
WHERE slug = 'caju' AND (theme = '{}'::jsonb OR copy = '{}'::jsonb);

-- 3. Permitir leitura pública dos tenants ativos (branding no login precisa disso)
DROP POLICY IF EXISTS "tenants_public_read_active" ON public.tenants;
CREATE POLICY "tenants_public_read_active"
  ON public.tenants FOR SELECT
  USING (ativo = true);

GRANT SELECT ON public.tenants TO anon;

-- 4. RPCs administrativas (super_admin)

-- Listar tenants + contagem de usuários
CREATE OR REPLACE FUNCTION public.admin_list_tenants()
RETURNS TABLE (
  id uuid, slug text, nome text, ativo boolean,
  theme jsonb, copy jsonb,
  logo_url text, logo_dark_url text, logo_symbol_url text, favicon_url text,
  primary_color text,
  user_count bigint,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT t.id, t.slug, t.nome, t.ativo, t.theme, t.copy,
           t.logo_url, t.logo_dark_url, t.logo_symbol_url, t.favicon_url,
           t.primary_color,
           (SELECT COUNT(*) FROM public.user_tenants ut WHERE ut.tenant_id = t.id),
           t.created_at, t.updated_at
    FROM public.tenants t
    ORDER BY t.created_at ASC;
END;
$$;

-- Criar tenant
CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  _slug text,
  _nome text,
  _theme jsonb DEFAULT '{}'::jsonb,
  _copy jsonb DEFAULT '{}'::jsonb,
  _logo_url text DEFAULT NULL,
  _logo_dark_url text DEFAULT NULL,
  _logo_symbol_url text DEFAULT NULL,
  _favicon_url text DEFAULT NULL,
  _primary_color text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _slug !~ '^[a-z0-9][a-z0-9_-]*$' THEN
    RAISE EXCEPTION 'slug inválido (use apenas a-z, 0-9, hífen, underscore)';
  END IF;
  INSERT INTO public.tenants (slug, nome, theme, copy, logo_url, logo_dark_url, logo_symbol_url, favicon_url, primary_color)
  VALUES (_slug, _nome, COALESCE(_theme,'{}'::jsonb), COALESCE(_copy,'{}'::jsonb),
          _logo_url, _logo_dark_url, _logo_symbol_url, _favicon_url, _primary_color)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Atualizar tenant (patch parcial)
CREATE OR REPLACE FUNCTION public.admin_update_tenant(
  _id uuid,
  _nome text DEFAULT NULL,
  _ativo boolean DEFAULT NULL,
  _theme jsonb DEFAULT NULL,
  _copy jsonb DEFAULT NULL,
  _logo_url text DEFAULT NULL,
  _logo_dark_url text DEFAULT NULL,
  _logo_symbol_url text DEFAULT NULL,
  _favicon_url text DEFAULT NULL,
  _primary_color text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.tenants SET
    nome            = COALESCE(_nome, nome),
    ativo           = COALESCE(_ativo, ativo),
    theme           = COALESCE(_theme, theme),
    copy            = COALESCE(_copy, copy),
    logo_url        = COALESCE(_logo_url, logo_url),
    logo_dark_url   = COALESCE(_logo_dark_url, logo_dark_url),
    logo_symbol_url = COALESCE(_logo_symbol_url, logo_symbol_url),
    favicon_url     = COALESCE(_favicon_url, favicon_url),
    primary_color   = COALESCE(_primary_color, primary_color),
    updated_at      = now()
  WHERE id = _id;
END;
$$;

-- Listar membros de um tenant
CREATE OR REPLACE FUNCTION public.admin_list_tenant_users(_tenant_id uuid)
RETURNS TABLE (
  user_id uuid, email text, full_name text, is_default boolean, linked_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT ut.user_id, u.email::text, p.full_name, ut.is_default, ut.created_at
    FROM public.user_tenants ut
    JOIN auth.users u ON u.id = ut.user_id
    LEFT JOIN public.profiles p ON p.id = ut.user_id
    WHERE ut.tenant_id = _tenant_id
    ORDER BY ut.created_at ASC;
END;
$$;

-- Vincular usuário (por email) a um tenant
CREATE OR REPLACE FUNCTION public.admin_link_user_to_tenant(
  _email text,
  _tenant_id uuid,
  _is_default boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = lower(_email);
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'usuário com email % não encontrado', _email;
  END IF;
  IF _is_default THEN
    UPDATE public.user_tenants SET is_default = false WHERE user_id = target_user_id;
  END IF;
  INSERT INTO public.user_tenants (user_id, tenant_id, is_default)
  VALUES (target_user_id, _tenant_id, _is_default)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET is_default = EXCLUDED.is_default;
  RETURN target_user_id;
END;
$$;

-- Desvincular usuário
CREATE OR REPLACE FUNCTION public.admin_unlink_user_from_tenant(
  _user_id uuid,
  _tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_tenants
   WHERE user_id = _user_id AND tenant_id = _tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_tenant(text,text,jsonb,jsonb,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_tenant(uuid,text,boolean,jsonb,jsonb,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_tenant_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_user_to_tenant(text,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlink_user_from_tenant(uuid,uuid) TO authenticated;

-- 5. Policies do bucket tenant-assets (bucket criado via tool separado)
DROP POLICY IF EXISTS "tenant_assets_public_read" ON storage.objects;
CREATE POLICY "tenant_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenant-assets');

DROP POLICY IF EXISTS "tenant_assets_super_admin_write" ON storage.objects;
CREATE POLICY "tenant_assets_super_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-assets' AND public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "tenant_assets_super_admin_update" ON storage.objects;
CREATE POLICY "tenant_assets_super_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tenant-assets' AND public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "tenant_assets_super_admin_delete" ON storage.objects;
CREATE POLICY "tenant_assets_super_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tenant-assets' AND public.is_super_admin(auth.uid()));