-- 1. Drop deprecated SECURITY DEFINER function
DROP FUNCTION IF EXISTS public.get_user_unidade_id(uuid);

-- 2. Tighten indicadores_snapshots write policies (were USING/WITH CHECK true for any authenticated user)
DROP POLICY IF EXISTS "insert_indicadores_snapshots" ON public.indicadores_snapshots;
DROP POLICY IF EXISTS "update_indicadores_snapshots" ON public.indicadores_snapshots;
DROP POLICY IF EXISTS "delete_indicadores_snapshots" ON public.indicadores_snapshots;

CREATE POLICY "Admins/operators can insert indicadores_snapshots"
  ON public.indicadores_snapshots FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admins/operators can update indicadores_snapshots"
  ON public.indicadores_snapshots FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admins/operators can delete indicadores_snapshots"
  ON public.indicadores_snapshots FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 3. Document SECURITY DEFINER functions
COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 'SECURITY DEFINER - safe: uses parameterized query against user_roles. Use with auth.uid() in RLS policies.';
COMMENT ON FUNCTION public.user_has_access_to_loja(uuid, uuid) IS 'SECURITY DEFINER - safe: uses parameterized query. Use with auth.uid() in RLS policies.';
COMMENT ON FUNCTION public.is_first_user() IS 'SECURITY DEFINER - safe: read-only check used by handle_new_user trigger.';
COMMENT ON FUNCTION public.handle_new_user() IS 'SECURITY DEFINER trigger function - bootstraps profile and grants admin role only when no users exist.';