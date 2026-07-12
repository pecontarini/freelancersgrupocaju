
-- =============================================================
-- Drop de tabelas dos módulos removidos
-- =============================================================

-- Auditoria / Diagnóstico
DROP TABLE IF EXISTS public.audit_alerts CASCADE;
DROP TABLE IF EXISTS public.audit_sector_scores CASCADE;
DROP TABLE IF EXISTS public.audit_upload_logs CASCADE;
DROP TABLE IF EXISTS public.supervision_audits CASCADE;
DROP TABLE IF EXISTS public.supervision_failures CASCADE;
DROP TABLE IF EXISTS public.checklist_corrections CASCADE;

-- Planos de ação (só usados pelo Diagnóstico)
DROP TABLE IF EXISTS public.action_plan_comments CASCADE;
DROP TABLE IF EXISTS public.action_plans CASCADE;
DROP TABLE IF EXISTS public.planos_acao CASCADE;

-- Indicadores / Metas / Reclamações
DROP TABLE IF EXISTS public.indicadores_snapshots CASCADE;
DROP TABLE IF EXISTS public.metas_snapshot CASCADE;
DROP TABLE IF EXISTS public.metas_cargo CASCADE;
DROP TABLE IF EXISTS public.nps_targets CASCADE;
DROP TABLE IF EXISTS public.reclamacoes_comentarios CASCADE;
DROP TABLE IF EXISTS public.reclamacoes CASCADE;
DROP TABLE IF EXISTS public.reclamacoes_config CASCADE;
DROP TABLE IF EXISTS public.avaliacoes CASCADE;

-- Remuneração Variável / Performance de Liderança
DROP TABLE IF EXISTS public.payout_indicator_sources CASCADE;
DROP TABLE IF EXISTS public.payout_orphan_records CASCADE;
DROP TABLE IF EXISTS public.payout_results_monthly CASCADE;
DROP TABLE IF EXISTS public.payout_role_target CASCADE;
DROP TABLE IF EXISTS public.payout_rules CASCADE;
DROP TABLE IF EXISTS public.bonus_config CASCADE;
DROP TABLE IF EXISTS public.bonus_rules CASCADE;
DROP TABLE IF EXISTS public.leadership_calculation_log CASCADE;
DROP TABLE IF EXISTS public.leadership_performance_scores CASCADE;
DROP TABLE IF EXISTS public.leadership_store_scores CASCADE;
DROP TABLE IF EXISTS public.store_performance CASCADE;
DROP TABLE IF EXISTS public.store_performance_entries CASCADE;
DROP TABLE IF EXISTS public.salmon_efficiency_daily CASCADE;

-- Quadro Operacional / POP / Rede
DROP TABLE IF EXISTS public.pop_ajustes_manuais CASCADE;
DROP TABLE IF EXISTS public.pop_minimo_padrao CASCADE;
DROP TABLE IF EXISTS public.pop_overrides CASCADE;
DROP TABLE IF EXISTS public.pop_reconciliacao_log CASCADE;
DROP TABLE IF EXISTS public.pop_relatorios_enviados CASCADE;
DROP TABLE IF EXISTS public.pop_unidades_agregadas CASCADE;
DROP TABLE IF EXISTS public.pracas_plano_chao CASCADE;
