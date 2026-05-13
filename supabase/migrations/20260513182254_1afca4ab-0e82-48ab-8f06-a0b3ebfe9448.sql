-- 1) Allow manual and auto rows to coexist
ALTER TABLE public.payout_results_monthly
  DROP CONSTRAINT IF EXISTS payout_results_monthly_loja_id_cargo_indicador_mes_ref_key;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'payout_results_monthly_unique_with_origin') THEN
    CREATE UNIQUE INDEX payout_results_monthly_unique_with_origin
      ON public.payout_results_monthly (loja_id, cargo, indicador, mes_ref, source_origin);
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.parse_kds_brand_avg(uuid, date, text);
DROP FUNCTION IF EXISTS public.parse_nps_revenue(uuid, date, text);
DROP FUNCTION IF EXISTS public.parse_cmv_salmao_avg(uuid, date);
DROP FUNCTION IF EXISTS public.parse_cmv_carnes_diff(uuid, date);

CREATE FUNCTION public.parse_cmv_salmao_avg(p_loja_id uuid, p_mes_ref date)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_payload jsonb; v_loja_code text; v_loja_cnpj text; v_item jsonb; v_raw text;
BEGIN
  SELECT code, cnpj INTO v_loja_code, v_loja_cnpj FROM public.config_lojas WHERE id = p_loja_id;
  v_payload := public.get_latest_payload('cmv-salmao');
  IF v_payload IS NULL OR v_loja_code IS NULL THEN RETURN NULL; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_payload->'items') LOOP
    v_raw := v_item->>'loja_codigo';
    IF public.normalize_loja_code(v_raw) = v_loja_code
       OR (v_loja_cnpj IS NOT NULL
           AND length(regexp_replace(coalesce(v_raw,''),'\D','','g')) >= 14
           AND regexp_replace(v_raw,'\D','','g') = regexp_replace(v_loja_cnpj,'\D','','g'))
    THEN
      RETURN NULLIF(v_item->>'valor','')::numeric;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.parse_cmv_salmao_avg(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_cmv_salmao_avg(uuid, date) TO authenticated, service_role;

CREATE FUNCTION public.parse_cmv_carnes_diff(p_loja_id uuid, p_mes_ref date)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_payload jsonb; v_loja_code text; v_avg numeric;
BEGIN
  SELECT code INTO v_loja_code FROM public.config_lojas WHERE id = p_loja_id;
  v_payload := public.get_latest_payload('cmv-carnes');
  IF v_payload IS NULL OR v_loja_code IS NULL THEN RETURN NULL; END IF;
  IF NOT (v_payload->'lojas') @> to_jsonb(v_loja_code) THEN RETURN NULL; END IF;
  SELECT AVG(ABS(NULLIF(cat->'valores'->>v_loja_code,'')::numeric))
    INTO v_avg
  FROM jsonb_array_elements(v_payload->'categorias') cat
  WHERE (cat->'valores' ? v_loja_code)
    AND (cat->'valores'->>v_loja_code) IS NOT NULL
    AND (cat->'valores'->>v_loja_code) <> '';
  RETURN v_avg;
END $$;
REVOKE ALL ON FUNCTION public.parse_cmv_carnes_diff(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_cmv_carnes_diff(uuid, date) TO authenticated, service_role;

CREATE FUNCTION public.parse_nps_revenue(p_loja_id uuid, p_mes_ref date, p_canal text)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_payload jsonb; v_loja_code text; v_arr_key text; v_item jsonb;
BEGIN
  SELECT code INTO v_loja_code FROM public.config_lojas WHERE id = p_loja_id;
  v_payload := public.get_latest_payload('atendimento-medias');
  IF v_payload IS NULL OR v_loja_code IS NULL THEN RETURN NULL; END IF;
  v_arr_key := CASE WHEN p_canal ILIKE '%delivery%' THEN 'delivery' ELSE 'salao' END;
  IF v_payload->v_arr_key IS NULL THEN RETURN NULL; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_payload->v_arr_key) LOOP
    IF public.normalize_loja_code(v_item->>'loja_codigo') = v_loja_code THEN
      RETURN NULLIF(v_item->>'rsPorAval','')::numeric;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.parse_nps_revenue(uuid, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_nps_revenue(uuid, date, text) TO authenticated, service_role;

CREATE FUNCTION public.parse_kds_brand_avg(p_loja_id uuid, p_mes_ref date, p_meta_key text)
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
REVOKE ALL ON FUNCTION public.parse_kds_brand_avg(uuid, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_kds_brand_avg(uuid, date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.compute_payouts(p_mes_ref date)
RETURNS TABLE(processed integer, succeeded integer, failed integer, orphans integer, run_id text, errors jsonb)
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
      ON CONFLICT (loja_id, cargo, indicador, mes_ref, source_origin) DO UPDATE
        SET resultado_valor = EXCLUDED.resultado_valor,
            breakpoint_atingido = EXCLUDED.breakpoint_atingido,
            breakpoint_descricao = EXCLUDED.breakpoint_descricao,
            payout_brl = EXCLUDED.payout_brl,
            run_id = EXCLUDED.run_id, computed_at = now();
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

DO $$ BEGIN RAISE NOTICE 'B6 migration applied: parsers refreshed and unique key now includes source_origin'; END $$;