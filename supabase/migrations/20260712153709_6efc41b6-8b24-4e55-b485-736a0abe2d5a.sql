
-- 1. RPC público para buscar branding de qualquer tenant ativo (roda antes do login)
CREATE OR REPLACE FUNCTION public.get_tenant_branding(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id,
    'slug', slug,
    'nome', nome,
    'theme', COALESCE(theme, '{}'::jsonb),
    'copy', COALESCE(copy, '{}'::jsonb),
    'logo_url', logo_url,
    'logo_dark_url', logo_dark_url,
    'logo_symbol_url', logo_symbol_url,
    'favicon_url', favicon_url,
    'primary_color', primary_color
  )
  FROM public.tenants
  WHERE slug = _slug
    AND ativo = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_branding(text) TO anon, authenticated;

-- 2. RPC público para listar slugs ativos (para descobrir tenants existentes na landing 2board)
CREATE OR REPLACE FUNCTION public.list_public_tenant_slugs()
RETURNS TABLE(slug text, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT slug, nome FROM public.tenants WHERE ativo = true ORDER BY nome;
$$;

GRANT EXECUTE ON FUNCTION public.list_public_tenant_slugs() TO anon, authenticated;

-- 3. Criar tenant "2board" (marca guarda-chuva / root)
INSERT INTO public.tenants (slug, nome, ativo, theme, copy, primary_color)
VALUES (
  '2board',
  '2board',
  true,
  jsonb_build_object(
    'primary', '220 90% 56%',
    'primaryStrong', '220 90% 45%',
    'accent', '220 90% 56%'
  ),
  jsonb_build_object(
    'appName', '2board',
    'tagline', 'Plataforma de gestão operacional',
    'browserTitle', '2board · Plataforma de gestão operacional',
    'metaDescription', 'A plataforma completa para gestão operacional: escalas, freelancers, checklists, CMV, metas e indicadores.',
    'terms', jsonb_build_object('unit', 'unidade', 'unitPlural', 'unidades', 'group', 'grupo')
  ),
  '#3B82F6'
)
ON CONFLICT (slug) DO NOTHING;
