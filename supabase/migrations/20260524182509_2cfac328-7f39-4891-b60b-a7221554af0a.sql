
-- Helper: enable RLS + admin-only on a list of legacy/backup tables
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    '_backup_employees_pre_secullum',
    '_backup_orfaos_20mai_2026',
    '_backup_job_titles_dedup_21mai_2026',
    '_backup_job_titles_lixos_21mai_2026',
    '_backup_sectors_dedup_20mai_2026',
    '_backup_staffing_matrix_dedup_20mai_2026',
    'cargo_aliases',
    'cargo_aliases_pendentes'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %1$s" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Admins manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))',
      t
    );
  END LOOP;
END $$;

-- inativacoes_audit_log: admin + dp_auditor can read; admin can write
ALTER TABLE public.inativacoes_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and auditors can read inativacoes_audit_log" ON public.inativacoes_audit_log;
CREATE POLICY "Admins and auditors can read inativacoes_audit_log"
  ON public.inativacoes_audit_log
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'dp_auditor'::app_role)
  );

DROP POLICY IF EXISTS "Admins manage inativacoes_audit_log" ON public.inativacoes_audit_log;
CREATE POLICY "Admins manage inativacoes_audit_log"
  ON public.inativacoes_audit_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- sheets_sources: restrict SELECT to admins + operators only
DROP POLICY IF EXISTS "Authenticated users can view sheets_sources" ON public.sheets_sources;
CREATE POLICY "Admins and operators can view sheets_sources"
  ON public.sheets_sources
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );
