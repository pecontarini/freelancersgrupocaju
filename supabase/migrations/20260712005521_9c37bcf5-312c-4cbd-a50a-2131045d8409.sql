
-- 1. Tabela de tenants (empresas / marcas)
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  primary_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Ligação usuário ↔ tenant
CREATE TABLE public.user_tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX idx_user_tenants_user ON public.user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant ON public.user_tenants(tenant_id);

GRANT SELECT ON public.user_tenants TO authenticated;
GRANT ALL ON public.user_tenants TO service_role;

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- 3. Funções auxiliares
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.user_tenants
  WHERE user_id = auth.uid()
  ORDER BY is_default DESC, created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenants
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
  )
  OR public.is_super_admin(_user_id);
$$;

-- 4. Policies em tenants
CREATE POLICY "Usuários veem tenants aos quais pertencem"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (public.user_has_tenant(auth.uid(), id));

CREATE POLICY "Super admin gerencia tenants"
  ON public.tenants
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. Policies em user_tenants
CREATE POLICY "Usuário vê seus próprios vínculos"
  ON public.user_tenants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin gerencia vínculos"
  ON public.user_tenants
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 6. Trigger updated_at
CREATE OR REPLACE FUNCTION public.tenants_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.tenants_set_updated_at();

-- 7. Seed do tenant Caju
INSERT INTO public.tenants (slug, nome, primary_color)
VALUES ('caju', 'Grupo Caju', '#D55A1E')
ON CONFLICT (slug) DO NOTHING;

-- 8. Vincular TODOS os usuários existentes ao tenant caju como default
INSERT INTO public.user_tenants (user_id, tenant_id, is_default)
SELECT u.id, t.id, true
FROM auth.users u
CROSS JOIN public.tenants t
WHERE t.slug = 'caju'
ON CONFLICT (user_id, tenant_id) DO NOTHING;
