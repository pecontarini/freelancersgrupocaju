-- Sprint 0 · sheets_sources cleanup (column names adapted: nome/ativo/ultimo_status)
CREATE TABLE IF NOT EXISTS public._sprint0_sheets_sources_backup AS
  SELECT *, now() AS backup_at FROM public.sheets_sources;

ALTER TABLE public.sheets_sources
  ADD COLUMN IF NOT EXISTS deactivated_reason text,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

UPDATE public.sheets_sources
   SET ativo = false,
       sync_diario = false,
       deactivated_reason = 'Erro parser persistente desde 2026-04',
       deactivated_at = now()
 WHERE nome = 'NPS & Reclamações';

UPDATE public.sheets_sources
   SET ativo = false,
       sync_diario = false,
       deactivated_reason = 'Sem meta_key — candidata a remoção em 90 dias',
       deactivated_at = now()
 WHERE meta_key IS NULL
   AND nome LIKE 'Pendente Mapeamento%';

UPDATE public.sheets_sources
   SET deactivated_reason = 'Pendente revisão do parser — manter inativa até confirmar'
 WHERE nome = 'Reclamações — Faturamento' AND ativo = false;

UPDATE public.sheets_sources
   SET sync_diario = true
 WHERE ativo = true
   AND ultimo_status = 'ok'
   AND meta_key IS NOT NULL;

DO $verify$
DECLARE
  v_active_sync int;
  v_inactive_total int;
BEGIN
  SELECT COUNT(*) INTO v_active_sync
    FROM public.sheets_sources
   WHERE ativo = true AND sync_diario = true;

  SELECT COUNT(*) INTO v_inactive_total
    FROM public.sheets_sources
   WHERE ativo = false;

  IF v_active_sync <> 9 THEN
    RAISE EXCEPTION 'sprint0_01: esperado 9 ativas com sync_diario, encontrado %', v_active_sync;
  END IF;

  IF v_inactive_total < 5 THEN
    RAISE EXCEPTION 'sprint0_01: esperado >=5 inativas, encontrado %', v_inactive_total;
  END IF;

  RAISE NOTICE 'sprint0_01 OK: % ativas com sync_diario, % inativas', v_active_sync, v_inactive_total;
END
$verify$;