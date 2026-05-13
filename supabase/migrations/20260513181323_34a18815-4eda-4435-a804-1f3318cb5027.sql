BEGIN;

DROP FUNCTION IF EXISTS public.import_payout_rules_from_sheet();
DROP FUNCTION IF EXISTS public.compute_payouts(date);

CREATE OR REPLACE FUNCTION public.get_latest_payload(p_meta_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT sbs.payload
    FROM public.sheets_blocks_snapshot sbs
    JOIN public.sheets_sources ss ON ss.id = sbs.source_id
   WHERE ss.meta_key = p_meta_key AND ss.ativo = true
   ORDER BY sbs.created_at DESC LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_latest_payload(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_latest_payload(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_loja_id(p_raw_identifier text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_normalized text; v_loja_id uuid;
BEGIN
  IF p_raw_identifier IS NULL OR trim(p_raw_identifier) = '' THEN RETURN NULL; END IF;
  v_normalized := public.normalize_loja_code(p_raw_identifier);
  SELECT id INTO v_loja_id FROM public.config_lojas WHERE code = v_normalized AND is_active = true;
  IF v_loja_id IS NOT NULL THEN RETURN v_loja_id; END IF;
  SELECT id INTO v_loja_id FROM public.config_lojas WHERE cnpj = p_raw_identifier AND is_active = true;
  IF v_loja_id IS NOT NULL THEN RETURN v_loja_id; END IF;
  SELECT id INTO v_loja_id FROM public.config_lojas
   WHERE nome ILIKE '%' || p_raw_identifier || '%' AND is_active = true LIMIT 1;
  RETURN v_loja_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.resolve_loja_id(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.resolve_loja_id(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.import_payout_rules_from_sheet()
RETURNS TABLE(inserted int, updated int, skipped int, errors jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_payload jsonb; v_row jsonb;
  v_inserted int := 0; v_updated int := 0; v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb; v_direcao text; v_existing bigint;
BEGIN
  v_payload := public.get_latest_payload('payout_rules');
  IF v_payload IS NULL THEN
    RETURN QUERY SELECT 0,0,0, '[{"error":"sem snapshot"}]'::jsonb; RETURN;
  END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_payload->'items') LOOP
    BEGIN
      v_direcao := CASE WHEN v_row->>'indicador' IN ('CMV','CMV CAMINITO','CMV NAZO','Tempo de Prato','Tempo Delivery')
        THEN 'LOW' ELSE 'HIGH' END;
      SELECT id INTO v_existing FROM public.payout_rules
       WHERE cargo = v_row->>'cargo' AND indicador = v_row->>'indicador'
         AND breakpoint = (v_row->>'breakpoint')::numeric
         AND valid_from = date_trunc('month', current_date)::date LIMIT 1;
      INSERT INTO public.payout_rules (cargo, indicador, breakpoint, descricao, payout_brl, direcao, valid_from)
      VALUES (v_row->>'cargo', v_row->>'indicador', (v_row->>'breakpoint')::numeric,
        COALESCE(v_row->>'descricao', ''), (v_row->>'payout_brl')::numeric, v_direcao,
        date_trunc('month', current_date)::date)
      ON CONFLICT (cargo, indicador, breakpoint, valid_from) DO UPDATE
        SET descricao = EXCLUDED.descricao, payout_brl = EXCLUDED.payout_brl,
            direcao = EXCLUDED.direcao, updated_at = now();
      IF v_existing IS NULL THEN v_inserted := v_inserted + 1;
      ELSE v_updated := v_updated + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_row, 'error', SQLERRM));
    END;
  END LOOP;
  RETURN QUERY SELECT v_inserted, v_updated, v_skipped, v_errors;
END $$;
REVOKE EXECUTE ON FUNCTION public.import_payout_rules_from_sheet() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.import_payout_rules_from_sheet() TO authenticated;

CREATE OR REPLACE FUNCTION public.parse_payout_registry_to_results()
RETURNS TABLE(inserted int, updated int, orphans int, errors jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_payload jsonb; v_row jsonb;
  v_inserted int := 0; v_updated int := 0; v_orphans int := 0;
  v_errors jsonb := '[]'::jsonb; v_loja_id uuid; v_mes_ref date;
  v_periodo_str text; v_existing bigint; v_resultado numeric; v_payout numeric;
BEGIN
  v_payload := public.get_latest_payload('payout_registry');
  IF v_payload IS NULL THEN
    RETURN QUERY SELECT 0,0,0,'[{"error":"sem snapshot"}]'::jsonb; RETURN;
  END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_payload->'items') LOOP
    BEGIN
      v_loja_id := public.resolve_loja_id(v_row->>'loja_code');
      IF v_loja_id IS NULL THEN v_loja_id := public.resolve_loja_id(v_row->>'loja_nome'); END IF;
      IF v_loja_id IS NULL THEN
        INSERT INTO public.payout_orphan_records (source_meta_key, raw_loja_identifier, raw_payload)
        VALUES ('payout_registry', COALESCE(v_row->>'loja_code', v_row->>'loja_nome', '?'), v_row);
        v_orphans := v_orphans + 1; CONTINUE;
      END IF;
      v_periodo_str := v_row->>'periodo';
      BEGIN
        v_mes_ref := date_trunc('month', to_date(v_periodo_str, 'FMDD/FMMM/YYYY'))::date;
      EXCEPTION WHEN OTHERS THEN
        v_mes_ref := date_trunc('month', current_date)::date;
      END;
      IF v_mes_ref IS NULL THEN v_mes_ref := date_trunc('month', current_date)::date; END IF;
      v_resultado := NULLIF(v_row->>'resultado','')::numeric;
      v_payout := COALESCE(NULLIF(v_row->>'payout_brl','')::numeric, 0);
      SELECT id INTO v_existing FROM public.payout_results_monthly
       WHERE loja_id = v_loja_id AND cargo = v_row->>'cargo'
         AND indicador = v_row->>'indicador' AND mes_ref = v_mes_ref LIMIT 1;
      INSERT INTO public.payout_results_monthly
        (loja_id, cargo, indicador, mes_ref, resultado_valor, breakpoint_descricao,
         payout_brl, source_origin, source_meta_key, computed_by)
      VALUES (v_loja_id, v_row->>'cargo', v_row->>'indicador', v_mes_ref, v_resultado,
        v_row->>'breakpoint_desc', v_payout, 'manual_planilha', 'payout_registry',
        'parse_payout_registry_to_results')
      ON CONFLICT (loja_id, cargo, indicador, mes_ref) DO UPDATE
        SET resultado_valor = EXCLUDED.resultado_valor,
            breakpoint_descricao = EXCLUDED.breakpoint_descricao,
            payout_brl = EXCLUDED.payout_brl, computed_at = now()
        WHERE payout_results_monthly.source_origin = 'manual_planilha';
      IF v_existing IS NULL THEN v_inserted := v_inserted + 1;
      ELSE v_updated := v_updated + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_row, 'error', SQLERRM));
    END;
  END LOOP;
  RETURN QUERY SELECT v_inserted, v_updated, v_orphans, v_errors;
END $$;
REVOKE EXECUTE ON FUNCTION public.parse_payout_registry_to_results() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.parse_payout_registry_to_results() TO authenticated;

CREATE OR REPLACE FUNCTION public.parse_cmv_salmao_avg(p_loja_id uuid, p_mes_ref date)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_payload jsonb; v_loja_code text; v_item jsonb; v_cnpj text;
BEGIN
  SELECT code, cnpj INTO v_loja_code, v_cnpj FROM public.config_lojas WHERE id = p_loja_id;
  IF v_loja_code IS NULL THEN RETURN NULL; END IF;
  v_payload := public.get_latest_payload('cmv-salmao');
  IF v_payload IS NULL THEN RETURN NULL; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_payload->'items') LOOP
    IF public.normalize_loja_code(v_item->>'loja_codigo') = v_loja_code THEN
      RETURN NULLIF(v_item->>'valor','')::numeric;
    END IF;
    IF v_cnpj IS NOT NULL AND (v_item->>'loja_codigo') = v_cnpj THEN
      RETURN NULLIF(v_item->>'valor','')::numeric;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.parse_kds_brand_avg(p_loja_id uuid, p_mes_ref date, p_meta_key text DEFAULT 'kds-salao')
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_payload jsonb; v_loja_code text; v_item jsonb;
BEGIN
  SELECT code INTO v_loja_code FROM public.config_lojas WHERE id = p_loja_id;
  v_payload := public.get_latest_payload(p_meta_key);
  IF v_payload IS NULL OR v_loja_code IS NULL THEN RETURN NULL; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_payload->'items') LOOP
    IF public.normalize_loja_code(v_item->>'loja_codigo') = v_loja_code THEN
      RETURN NULLIF(v_item->>'valor','')::numeric;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.parse_nps_revenue(p_loja_id uuid, p_mes_ref date, p_canal text)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_payload jsonb; v_loja_code text; v_item jsonb; v_canal_filter text;
BEGIN
  SELECT code INTO v_loja_code FROM public.config_lojas WHERE id = p_loja_id;
  v_payload := public.get_latest_payload('atendimento-medias');
  IF v_payload IS NULL OR v_loja_code IS NULL THEN RETURN NULL; END IF;
  v_canal_filter := CASE
    WHEN p_canal ILIKE '%salão%' OR p_canal ILIKE '%salao%' THEN 'salao'
    WHEN p_canal ILIKE '%delivery%' THEN 'delivery'
    ELSE NULL END;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_payload->'items') LOOP
    IF public.normalize_loja_code(v_item->>'loja_codigo') = v_loja_code
       AND (v_item->>'canal') = v_canal_filter THEN
      RETURN NULLIF(v_item->>'valor','')::numeric;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.parse_conformidade(p_loja_id uuid, p_mes_ref date)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_payload jsonb; v_loja_code text; v_item jsonb;
BEGIN
  SELECT code INTO v_loja_code FROM public.config_lojas WHERE id = p_loja_id;
  v_payload := public.get_latest_payload('conformidade');
  IF v_payload IS NULL OR v_loja_code IS NULL THEN RETURN NULL; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_payload->'items') LOOP
    IF public.normalize_loja_code(v_item->>'loja_codigo') = v_loja_code THEN
      RETURN NULLIF(v_item->>'valor','')::numeric;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.parse_cmv_carnes_diff(p_loja_id uuid, p_mes_ref date)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_payload jsonb; v_loja_code text; v_item jsonb;
BEGIN
  SELECT code INTO v_loja_code FROM public.config_lojas WHERE id = p_loja_id;
  v_payload := public.get_latest_payload('cmv-carnes');
  IF v_payload IS NULL OR v_loja_code IS NULL THEN RETURN NULL; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_payload->'items') LOOP
    IF public.normalize_loja_code(v_item->>'loja_codigo') = v_loja_code THEN
      RETURN NULLIF(v_item->>'valor','')::numeric;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.parse_cmv_salmao_avg(uuid,date)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parse_kds_brand_avg(uuid,date,text)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parse_nps_revenue(uuid,date,text)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parse_conformidade(uuid,date)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parse_cmv_carnes_diff(uuid,date)       FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_cmv_salmao_avg(uuid,date)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.parse_kds_brand_avg(uuid,date,text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.parse_nps_revenue(uuid,date,text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.parse_conformidade(uuid,date)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.parse_cmv_carnes_diff(uuid,date)        TO authenticated;

CREATE OR REPLACE FUNCTION public.compute_payouts(p_mes_ref date)
RETURNS TABLE(processed int, succeeded int, failed int, orphans int, run_id text, errors jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_run_id text := gen_random_uuid()::text;
  v_processed int := 0; v_succeeded int := 0; v_failed int := 0; v_orphans int := 0;
  v_errors jsonb := '[]'::jsonb; v_job record; v_valor numeric; v_classification record;
BEGIN
  FOR v_job IN
    SELECT * FROM public.v_payout_jobs_to_compute
     WHERE source_meta_key NOT LIKE '__pending_%'
  LOOP
    v_processed := v_processed + 1;
    BEGIN
      v_valor := CASE v_job.parser_fn
        WHEN 'parse_cmv_salmao_avg'   THEN public.parse_cmv_salmao_avg(v_job.loja_id, p_mes_ref)
        WHEN 'parse_kds_brand_avg'    THEN public.parse_kds_brand_avg(v_job.loja_id, p_mes_ref, v_job.source_meta_key)
        WHEN 'parse_nps_revenue'      THEN public.parse_nps_revenue(v_job.loja_id, p_mes_ref, v_job.indicador)
        WHEN 'parse_conformidade'     THEN public.parse_conformidade(v_job.loja_id, p_mes_ref)
        WHEN 'parse_cmv_carnes_diff'  THEN public.parse_cmv_carnes_diff(v_job.loja_id, p_mes_ref)
        ELSE NULL
      END;
      IF v_valor IS NULL THEN
        v_failed := v_failed + 1;
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'loja', v_job.loja_code, 'cargo', v_job.cargo,
          'indicador', v_job.indicador, 'reason', 'parser retornou NULL'));
        CONTINUE;
      END IF;
      SELECT * INTO v_classification FROM public.classify_payout(v_job.cargo, v_job.indicador, v_valor);
      INSERT INTO public.payout_results_monthly (
        loja_id, cargo, indicador, mes_ref, resultado_valor, breakpoint_atingido,
        breakpoint_descricao, payout_brl, source_origin, source_meta_key, run_id, computed_by
      ) VALUES (
        v_job.loja_id, v_job.cargo, v_job.indicador, p_mes_ref,
        v_valor, v_classification.breakpoint_atingido, v_classification.breakpoint_descricao,
        COALESCE(v_classification.payout_brl, 0), 'auto_rpc', v_job.source_meta_key, v_run_id, 'compute_payouts'
      )
      ON CONFLICT (loja_id, cargo, indicador, mes_ref) DO UPDATE
        SET resultado_valor = EXCLUDED.resultado_valor,
            breakpoint_atingido = EXCLUDED.breakpoint_atingido,
            breakpoint_descricao = EXCLUDED.breakpoint_descricao,
            payout_brl = EXCLUDED.payout_brl,
            run_id = EXCLUDED.run_id, computed_at = now()
        WHERE payout_results_monthly.source_origin <> 'override';
      v_succeeded := v_succeeded + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'loja', v_job.loja_code, 'cargo', v_job.cargo,
        'indicador', v_job.indicador, 'error', SQLERRM));
    END;
  END LOOP;
  RETURN QUERY SELECT v_processed, v_succeeded, v_failed, v_orphans, v_run_id, v_errors;
END $$;
REVOKE EXECUTE ON FUNCTION public.compute_payouts(date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.compute_payouts(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_payouts(p_mes_ref date)
RETURNS TABLE(total_manual int, total_auto int, matches int, divergencias int, match_pct numeric, divergencias_detalhe jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_total_manual int; v_total_auto int; v_matches int; v_divergencias int; v_detalhe jsonb;
BEGIN
  SELECT COUNT(*) INTO v_total_manual FROM public.payout_results_monthly
   WHERE mes_ref = p_mes_ref AND source_origin = 'manual_planilha';
  SELECT COUNT(*) INTO v_total_auto FROM public.payout_results_monthly
   WHERE mes_ref = p_mes_ref AND source_origin = 'auto_rpc';
  WITH manual AS (
    SELECT loja_id, cargo, indicador, payout_brl FROM public.payout_results_monthly
     WHERE mes_ref = p_mes_ref AND source_origin = 'manual_planilha'
  ), auto_calc AS (
    SELECT loja_id, cargo, indicador, payout_brl FROM public.payout_results_monthly
     WHERE mes_ref = p_mes_ref AND source_origin = 'auto_rpc'
  ), comparison AS (
    SELECT m.loja_id, m.cargo, m.indicador,
           m.payout_brl AS manual_brl, a.payout_brl AS auto_brl,
           ABS(m.payout_brl - COALESCE(a.payout_brl, 0)) <= 0.01 AS match
      FROM manual m LEFT JOIN auto_calc a USING (loja_id, cargo, indicador)
  )
  SELECT
    COUNT(*) FILTER (WHERE match = true)::int,
    COUNT(*) FILTER (WHERE match = false OR match IS NULL)::int,
    jsonb_agg(jsonb_build_object(
      'loja_id', loja_id, 'cargo', cargo, 'indicador', indicador,
      'manual', manual_brl, 'auto', auto_brl
    )) FILTER (WHERE match = false OR match IS NULL)
  INTO v_matches, v_divergencias, v_detalhe FROM comparison;
  RETURN QUERY SELECT v_total_manual, v_total_auto, v_matches, v_divergencias,
    CASE WHEN v_total_manual = 0 THEN 0
         ELSE ROUND((v_matches::numeric / v_total_manual) * 100, 2) END,
    COALESCE(v_detalhe, '[]'::jsonb);
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_payouts(date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.validate_payouts(date) TO authenticated;

DO $verify$
DECLARE v_funcs int;
BEGIN
  SELECT COUNT(*) INTO v_funcs FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN (
     'get_latest_payload','resolve_loja_id',
     'import_payout_rules_from_sheet','parse_payout_registry_to_results',
     'parse_cmv_salmao_avg','parse_kds_brand_avg','parse_nps_revenue',
     'parse_conformidade','parse_cmv_carnes_diff',
     'compute_payouts','validate_payouts');
  IF v_funcs <> 11 THEN
    RAISE EXCEPTION 'B5 falhou: esperado 11 funcoes, encontrado %', v_funcs;
  END IF;
  RAISE NOTICE 'B5 OK: 11 funcoes (helpers + import + parsers + compute + validate)';
END $verify$;

COMMIT;