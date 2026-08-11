CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  _slug text,
  _nome text,
  _theme jsonb DEFAULT '{}'::jsonb,
  _copy jsonb DEFAULT '{}'::jsonb,
  _logo_url text DEFAULT NULL::text,
  _logo_dark_url text DEFAULT NULL::text,
  _logo_symbol_url text DEFAULT NULL::text,
  _favicon_url text DEFAULT NULL::text,
  _primary_color text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _slug !~ '^[a-z0-9][a-z0-9_-]*$' THEN
    RAISE EXCEPTION 'slug inválido (use apenas a-z, 0-9, hífen, underscore)';
  END IF;

  INSERT INTO public.tenants (
    slug,
    nome,
    theme,
    copy,
    logo_url,
    logo_dark_url,
    logo_symbol_url,
    favicon_url,
    primary_color
  )
  VALUES (
    _slug,
    _nome,
    COALESCE(_theme, '{}'::jsonb),
    COALESCE(_copy, '{}'::jsonb),
    _logo_url,
    _logo_dark_url,
    _logo_symbol_url,
    _favicon_url,
    _primary_color
  )
  RETURNING id INTO new_id;

  INSERT INTO public.shifts (name, start_time, end_time, type, tenant_id)
  VALUES
    ('Almoço', '08:00'::time, '16:00'::time, 'almoco', new_id),
    ('Jantar', '16:00'::time, '00:00'::time, 'jantar', new_id);

  RETURN new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_create_tenant(text,text,jsonb,jsonb,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_tenant(text,text,jsonb,jsonb,text,text,text,text,text) TO authenticated;