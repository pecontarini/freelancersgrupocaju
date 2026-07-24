
-- 1. Drop hardcoded CajuPAR default from every tenant_id column in public schema
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
      AND column_default LIKE '%8d4e0681-3ddd-4054-9034-4c01f596055c%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id DROP DEFAULT', r.table_name);
  END LOOP;
END $$;

-- 2. Generalize the tenant resolution trigger to handle any table with unit_id or loja_id
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
BEGIN
  IF NEW.tenant_id IS NULL THEN
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
      EXECUTE format('SELECT ($1).%I', 'unit_id') INTO target_loja USING NEW;
    END IF;
    IF target_loja IS NULL AND has_loja_id THEN
      EXECUTE format('SELECT ($1).%I', 'loja_id') INTO target_loja USING NEW;
    END IF;

    IF target_loja IS NOT NULL THEN
      SELECT tenant_id INTO unit_tenant FROM public.config_lojas WHERE id = target_loja;
      IF unit_tenant IS NOT NULL THEN
        NEW.tenant_id := unit_tenant;
        RETURN NEW;
      END IF;
    END IF;

    -- Fallback: user's active tenant context
    ctx_tenant := public.current_tenant_id();
    IF ctx_tenant IS NOT NULL THEN
      NEW.tenant_id := ctx_tenant;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Attach the trigger to every public table that has a tenant_id column
DO $$
DECLARE
  r record;
  trg_name text;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
  LOOP
    trg_name := 'trg_set_tenant_id';
    -- Drop old trigger if exists to recreate cleanly
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trg_name, r.table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_context()',
      trg_name, r.table_name
    );
  END LOOP;
END $$;
