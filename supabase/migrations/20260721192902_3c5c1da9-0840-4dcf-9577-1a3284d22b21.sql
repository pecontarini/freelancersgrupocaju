
-- 1) Remove leftover test row from investigation (if present)
DELETE FROM public.employees WHERE id = '125f6195-d98a-4d6a-b0ab-6991d98377d2';

-- 2) Harden tenant_id resolution for employees:
--    Always derive tenant_id from the unit's tenant when not explicitly provided.
--    This prevents mismatches when the user's current_tenant_id() context is
--    ambiguous (multi-tenant users, super admins, service contexts) and the
--    column default would otherwise fall back to the Caju tenant.
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ctx_tenant uuid;
  unit_tenant uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    -- Prefer the tenant that owns the target unit — this is always correct
    -- for row-per-unit tables like employees.
    IF TG_TABLE_NAME = 'employees' AND NEW.unit_id IS NOT NULL THEN
      SELECT tenant_id INTO unit_tenant
      FROM public.config_lojas
      WHERE id = NEW.unit_id;
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
    -- Otherwise column DEFAULT applies.
  END IF;
  RETURN NEW;
END;
$function$;
