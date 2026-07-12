
-- =============================================================
-- FASE 4.1 · Estrutura de tenant_id em todas as tabelas de negócio
-- Backfill: todas as linhas existentes → tenant "caju"
-- Nenhuma policy RLS é alterada nesta migração
-- =============================================================

-- Função auxiliar para o trigger de auto-preenchimento
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx_tenant uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    -- Tenta pegar do contexto do usuário logado
    ctx_tenant := public.current_tenant_id();
    IF ctx_tenant IS NOT NULL THEN
      NEW.tenant_id := ctx_tenant;
    END IF;
    -- Se ainda for null, o DEFAULT da coluna (caju) assume
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  caju_id uuid;
  tbl text;
  business_tables text[] := ARRAY[
    'action_plan_comments','action_plans','agenda_eventos','ai_draft_slots',
    'audit_alerts','audit_sector_scores','audit_upload_logs','avaliacoes',
    'bonus_config','bonus_rules','bulk_import_logs','cargo_aliases',
    'cargo_aliases_pendentes','cargos','checkin_approvals','checkin_budget_entries',
    'checkin_stations','checklist_corrections','checklist_response_items',
    'checklist_responses','checklist_sector_links','checklist_template_items',
    'checklist_templates','cmv_camara','cmv_contagens','cmv_ignored_items',
    'cmv_inventory','cmv_items','cmv_movements','cmv_nfe_mappings',
    'cmv_pending_sales_items','cmv_praca','cmv_price_history','cmv_sales_mappings',
    'cmv_vendas_ajuste','cnpj_administrativo','config_funcoes','config_gerencias',
    'config_lojas','daily_budgets','daily_sales','daily_stock_positions',
    'employees','escala_aprovacao_links','escala_minima','escala_template',
    'escala_vinculacao','extras_checkins','freelancer_checkins','freelancer_entries',
    'freelancer_profiles','freelancer_profiles_audit','holding_freelancer_forecast',
    'holding_freelancer_rates','holding_staffing_config','import_jobs',
    'inativacoes_audit_log','indicadores_snapshots','inventario_items','inventarios',
    'inventory_transactions','items_catalog','job_titles','leadership_calculation_log',
    'leadership_performance_scores','leadership_store_scores','maintenance_budgets',
    'maintenance_entries','metas_cargo','metas_snapshot','missao_anexos',
    'missao_chat','missao_comentarios','missao_membros','missao_tarefas','missoes',
    'movimentacoes_estoque','n8n_webhook_endpoints','n8n_webhook_executions',
    'notification_logs','nps_targets','operational_expenses','payout_indicator_sources',
    'payout_orphan_records','payout_results_monthly','payout_role_target','payout_rules',
    'pix_validation_log','planos_acao','pop_ajustes_manuais','pop_minimo_padrao',
    'pop_overrides','pop_relatorios_enviados','pracas_plano_chao','reclamacoes',
    'reclamacoes_comentarios','reclamacoes_config','salmon_efficiency_daily',
    'schedule_attendance','schedule_breaks','schedule_draft_slots','schedule_drafts',
    'schedules','sector_job_titles','sector_partnerships','sectors','semanas_cmv',
    'setor_items','setores','sheets_blocks_snapshot','sheets_sources','sheets_staging',
    'shifts','sincronizacoes_sheets','solicitacoes_cadastro_urgente','staffing_matrix',
    'store_budgets','store_performance','store_performance_entries','supervision_audits',
    'supervision_failures','sync_secullum_log','time_punches','turno_config',
    'unit_partnerships','unit_secullum_mapping','utensilios_config','utensilios_contagens',
    'utensilios_items','utensilios_pedidos','whatsapp_dispatch_queue',
    'employee_merge_log','employee_remap_log','pop_reconciliacao_log','pop_unidades_agregadas'
  ];
BEGIN
  SELECT id INTO caju_id FROM public.tenants WHERE slug='caju';
  IF caju_id IS NULL THEN
    RAISE EXCEPTION 'Tenant caju não encontrado. Rode a migração anterior primeiro.';
  END IF;

  FOREACH tbl IN ARRAY business_tables LOOP
    -- Adiciona coluna com default = caju
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT %L REFERENCES public.tenants(id)',
      tbl, caju_id
    );

    -- Backfill (idempotente)
    EXECUTE format(
      'UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL',
      tbl, caju_id
    );

    -- NOT NULL
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL',
      tbl
    );

    -- Índice para performance de filtros RLS futuros
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)',
      'idx_' || tbl || '_tenant_id', tbl
    );

    -- Trigger de auto-preenchimento a partir do contexto do usuário
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.%I',
      tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_set_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_context()',
      tbl
    );
  END LOOP;
END $$;
