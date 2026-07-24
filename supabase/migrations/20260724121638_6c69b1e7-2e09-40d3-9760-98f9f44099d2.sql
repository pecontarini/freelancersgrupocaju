
-- 1. Restore the default on every tenant_id column so generated types keep tenant_id optional
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND (c.column_default IS NULL OR c.column_default NOT LIKE '%8d4e0681-3ddd-4054-9034-4c01f596055c%')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT ''8d4e0681-3ddd-4054-9034-4c01f596055c''::uuid', r.table_name);
  END LOOP;
END $$;

-- 2. Rewrite trigger: always try to resolve tenant from unit_id / loja_id; only fall back to caller context otherwise.
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ctx_tenant uuid;
  unit_tenant uuid;
  has_unit_id boolean;
  has_loja_id boolean;
  target_loja uuid;
  caju_default constant uuid := '8d4e0681-3ddd-4054-9034-4c01f596055c'::uuid;
BEGIN
  -- Detect presence of unit_id / loja_id on the target table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'unit_id'
  ) INTO has_unit_id;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'loja_id'
  ) INTO has_loja_id;

  IF has_unit_id THEN
    BEGIN
      EXECUTE format('SELECT ($1).%I', 'unit_id') INTO target_loja USING NEW;
    EXCEPTION WHEN others THEN target_loja := NULL;
    END;
  END IF;
  IF target_loja IS NULL AND has_loja_id THEN
    BEGIN
      EXECUTE format('SELECT ($1).%I', 'loja_id') INTO target_loja USING NEW;
    EXCEPTION WHEN others THEN target_loja := NULL;
    END;
  END IF;

  IF target_loja IS NOT NULL THEN
    SELECT tenant_id INTO unit_tenant FROM public.config_lojas WHERE id = target_loja;
    IF unit_tenant IS NOT NULL THEN
      -- Always trust the store's tenant: overrides column default and stale caller values.
      NEW.tenant_id := unit_tenant;
      RETURN NEW;
    END IF;
  END IF;

  -- No unit reference. If tenant_id is null or still equal to the legacy hardcoded default,
  -- resolve from the caller's active tenant context (authenticated user).
  IF NEW.tenant_id IS NULL OR NEW.tenant_id = caju_default THEN
    ctx_tenant := public.current_tenant_id();
    IF ctx_tenant IS NOT NULL THEN
      NEW.tenant_id := ctx_tenant;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Ensure trigger is attached to every public table with a tenant_id column
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.%I', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_set_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_context()',
      r.table_name
    );
  END LOOP;
END $$;
