ALTER TABLE public._sprint0_sheets_sources_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "_sprint0_backup_admin_only"
ON public._sprint0_sheets_sources_backup
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $verify$
DECLARE
  v_rls bool;
BEGIN
  SELECT relrowsecurity INTO v_rls
    FROM pg_class
   WHERE oid = 'public._sprint0_sheets_sources_backup'::regclass;
  IF NOT v_rls THEN
    RAISE EXCEPTION 'sprint0_01b: RLS não habilitado no backup';
  END IF;
END
$verify$;