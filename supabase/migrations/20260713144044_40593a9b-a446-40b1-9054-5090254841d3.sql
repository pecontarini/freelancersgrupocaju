
-- Isolamento por tenant via política RESTRITIVA em todas as tabelas com coluna tenant_id.
-- Combina em AND com as policies existentes: mesmo que uma policy diga "admin pode tudo",
-- o RESTRITIVO exige tenant_id = current_tenant_id() (ou super_admin).

DO $$
DECLARE
  t text;
  skip_tables text[] := ARRAY['user_tenants'];
  tables text[] := ARRAY[
    'agenda_eventos','ai_draft_slots','bulk_import_logs','cargo_aliases','cargo_aliases_pendentes',
    'cargos','checkin_approvals','checkin_budget_entries','checkin_stations','checklist_response_items',
    'checklist_responses','checklist_sector_links','checklist_template_items','checklist_templates',
    'cmv_camara','cmv_contagens','cmv_ignored_items','cmv_inventory','cmv_items','cmv_movements',
    'cmv_nfe_mappings','cmv_pending_sales_items','cmv_praca','cmv_price_history','cmv_sales_mappings',
    'cmv_vendas_ajuste','cnpj_administrativo','config_funcoes','config_gerencias','config_lojas',
    'daily_budgets','daily_sales','daily_stock_positions','employee_merge_log','employee_remap_log',
    'employees','escala_aprovacao_links','escala_minima','escala_template','escala_vinculacao',
    'extras_checkins','freelancer_checkins','freelancer_entries','freelancer_profiles',
    'freelancer_profiles_audit','holding_freelancer_forecast','holding_freelancer_rates',
    'holding_staffing_config','import_jobs','inativacoes_audit_log','inventario_items','inventarios',
    'inventory_transactions','items_catalog','job_titles','maintenance_budgets','maintenance_entries',
    'missao_anexos','missao_chat','missao_comentarios','missao_membros','missao_tarefas','missoes',
    'movimentacoes_estoque','n8n_webhook_endpoints','n8n_webhook_executions','notification_logs',
    'operational_expenses','pix_validation_log','schedule_attendance','schedule_breaks',
    'schedule_draft_slots','schedule_drafts','schedules','sector_job_titles','sector_partnerships',
    'sectors','semanas_cmv','setor_items','setores','sheets_blocks_snapshot','sheets_sources',
    'sheets_staging','shifts','sincronizacoes_sheets','solicitacoes_cadastro_urgente','staffing_matrix',
    'store_budgets','sync_secullum_log','time_punches','turno_config','unit_partnerships',
    'unit_secullum_mapping','utensilios_config','utensilios_contagens','utensilios_items',
    'utensilios_pedidos','whatsapp_dispatch_queue'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF t = ANY(skip_tables) THEN CONTINUE; END IF;

    -- Garante RLS habilitada
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Remove versão anterior se existir (idempotente)
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_restrictive" ON public.%I', t);

    -- Política RESTRITIVA: aplicada em AND com todas as outras
    EXECUTE format($f$
      CREATE POLICY "tenant_isolation_restrictive"
      ON public.%I
      AS RESTRICTIVE
      FOR ALL
      TO authenticated
      USING (
        public.is_super_admin(auth.uid())
        OR tenant_id = public.current_tenant_id()
        OR public.user_has_tenant(auth.uid(), tenant_id)
      )
      WITH CHECK (
        public.is_super_admin(auth.uid())
        OR tenant_id = public.current_tenant_id()
        OR public.user_has_tenant(auth.uid(), tenant_id)
      )
    $f$, t);
  END LOOP;
END $$;
