DROP POLICY IF EXISTS "Managers can insert their store budgets" ON public.store_budgets;
DROP POLICY IF EXISTS "Managers can update their store budgets" ON public.store_budgets;
DROP POLICY IF EXISTS "Store managers can view their store budgets" ON public.store_budgets;
DROP POLICY IF EXISTS p_store_budgets_gerente_read_only ON public.store_budgets;

CREATE POLICY p_store_budgets_gerente_read_only
  ON public.store_budgets
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'gerente_unidade'::app_role)
    AND user_has_access_to_loja(auth.uid(), store_id)
  );

DO $verify$
DECLARE
  v_write_policies int;
BEGIN
  SELECT COUNT(*) INTO v_write_policies
    FROM pg_policy
   WHERE polrelid='public.store_budgets'::regclass
     AND polcmd IN ('a','w','d','*')
     AND (
       COALESCE(pg_get_expr(polqual, polrelid),'') ILIKE '%gerente_unidade%'
       OR COALESCE(pg_get_expr(polwithcheck, polrelid),'') ILIKE '%gerente_unidade%'
     );

  IF v_write_policies > 0 THEN
    RAISE EXCEPTION 'sprint0_03: ainda existem % policy(s) de escrita p/ gerente_unidade', v_write_policies;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid='public.store_budgets'::regclass
       AND polname='p_store_budgets_gerente_read_only'
  ) THEN
    RAISE EXCEPTION 'sprint0_03: policy SELECT-only do gerente não foi criada';
  END IF;

  RAISE NOTICE 'sprint0_03 OK: gerente_unidade SELECT-only em store_budgets';
END
$verify$;