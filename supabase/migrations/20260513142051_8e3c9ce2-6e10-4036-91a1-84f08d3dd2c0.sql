BEGIN;

CREATE OR REPLACE FUNCTION public.import_payout_rules_from_sheet()
RETURNS TABLE(inserted int, updated int, errors text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_snapshot_id uuid;
  v_payload jsonb;
  v_errors text[] := ARRAY[]::text[];
BEGIN
  SELECT sbs.id, sbs.payload INTO v_snapshot_id, v_payload
    FROM public.sheets_blocks_snapshot sbs
    JOIN public.sheets_sources ss ON ss.id = sbs.source_id
   WHERE ss.meta_key = 'payout_rules' AND ss.ativo = true
   ORDER BY sbs.created_at DESC LIMIT 1;
  IF v_snapshot_id IS NULL THEN
    v_errors := array_append(v_errors, 'Snapshot de payout_rules não encontrado');
    RETURN QUERY SELECT 0, 0, v_errors;
    RETURN;
  END IF;
  RAISE NOTICE 'Snapshot encontrado, id=%, payload type=%', v_snapshot_id, jsonb_typeof(v_payload);
  RAISE NOTICE 'Parser real será implementado na Migration B4 após confirmação do schema do payload';
  RETURN QUERY SELECT 0, 0, v_errors;
END
$$;
REVOKE EXECUTE ON FUNCTION public.import_payout_rules_from_sheet() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.import_payout_rules_from_sheet() TO authenticated;

CREATE OR REPLACE FUNCTION public.compute_payouts(p_mes_ref date)
RETURNS TABLE(processed int, succeeded int, failed int, run_id text, errors jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_run_id text := gen_random_uuid()::text;
BEGIN
  RAISE NOTICE 'compute_payouts esqueleto, run_id=%', v_run_id;
  RETURN QUERY SELECT 0, 0, 0, v_run_id, '[]'::jsonb;
END
$$;
REVOKE EXECUTE ON FUNCTION public.compute_payouts(date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.compute_payouts(date) TO authenticated;

DO $verify$
DECLARE v_funcs int;
BEGIN
  SELECT COUNT(*) INTO v_funcs FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('classify_payout','compute_payouts','import_payout_rules_from_sheet');
  IF v_funcs <> 3 THEN RAISE EXCEPTION 'B3 falhou: esperado 3 funções, encontrado %', v_funcs; END IF;
  RAISE NOTICE 'B3 OK: classify + compute (esqueleto) + import_rules (esqueleto)';
END
$verify$;

COMMIT;