-- Sprint 0 · sheets_sources cleanup (column names adapted: nome/ativo/ultimo_status)
DROP POLICY IF EXISTS "Admins and operators full access metas_snapshot" ON public.metas_snapshot;
DROP POLICY IF EXISTS p_metas_snapshot_operator_scoped ON public.metas_snapshot;
DROP POLICY IF EXISTS p_metas_snapshot_admin_all ON public.metas_snapshot;

CREATE POLICY p_metas_snapshot_admin_all
  ON public.metas_snapshot
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY p_metas_snapshot_operator_scoped
  ON public.metas_snapshot
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operator'::app_role)
    AND loja_id IS NOT NULL
    AND user_has_access_to_loja(auth.uid(), loja_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'operator'::app_role)
    AND loja_id IS NOT NULL
    AND user_has_access_to_loja(auth.uid(), loja_id)
  );

DO $verify$
DECLARE
  v_pol_count int;
  v_has_scoped boolean;
  v_has_admin boolean;
BEGIN
  SELECT COUNT(*) INTO v_pol_count
    FROM pg_policy WHERE polrelid='public.metas_snapshot'::regclass;

  SELECT EXISTS (SELECT 1 FROM pg_policy
     WHERE polrelid='public.metas_snapshot'::regclass
       AND polname='p_metas_snapshot_operator_scoped') INTO v_has_scoped;

  SELECT EXISTS (SELECT 1 FROM pg_policy
     WHERE polrelid='public.metas_snapshot'::regclass
       AND polname='p_metas_snapshot_admin_all') INTO v_has_admin;

  IF NOT v_has_scoped THEN
    RAISE EXCEPTION 'sprint0_02: policy operator scoped não foi criada';
  END IF;
  IF NOT v_has_admin THEN
    RAISE EXCEPTION 'sprint0_02: policy admin all não foi criada';
  END IF;
  IF v_pol_count < 3 THEN
    RAISE EXCEPTION 'sprint0_02: total < 3, encontrado %', v_pol_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid='public.metas_snapshot'::regclass
       AND pg_get_expr(polqual, polrelid) ILIKE '%operator%'
       AND pg_get_expr(polqual, polrelid) NOT ILIKE '%user_has_access_to_loja%'
  ) THEN
    RAISE EXCEPTION 'sprint0_02: ainda existe policy de operator sem filtro por loja';
  END IF;

  RAISE NOTICE 'sprint0_02 OK: % policies em metas_snapshot', v_pol_count;
END
$verify$;