CREATE OR REPLACE FUNCTION public.parse_payout_registry_to_results()
RETURNS TABLE(inserted integer, updated integer, orphans integer, errors jsonb)
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
         AND indicador = v_row->>'indicador' AND mes_ref = v_mes_ref
         AND source_origin = 'manual_planilha' LIMIT 1;
      INSERT INTO public.payout_results_monthly
        (loja_id, cargo, indicador, mes_ref, resultado_valor, breakpoint_descricao,
         payout_brl, source_origin, source_meta_key, computed_by)
      VALUES (v_loja_id, v_row->>'cargo', v_row->>'indicador', v_mes_ref, v_resultado,
        v_row->>'breakpoint_desc', v_payout, 'manual_planilha', 'payout_registry',
        'parse_payout_registry_to_results')
      ON CONFLICT (loja_id, cargo, indicador, mes_ref, source_origin) DO UPDATE
        SET resultado_valor = EXCLUDED.resultado_valor,
            breakpoint_descricao = EXCLUDED.breakpoint_descricao,
            payout_brl = EXCLUDED.payout_brl, computed_at = now();
      IF v_existing IS NULL THEN v_inserted := v_inserted + 1;
      ELSE v_updated := v_updated + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_row, 'error', SQLERRM));
    END;
  END LOOP;
  RETURN QUERY SELECT v_inserted, v_updated, v_orphans, v_errors;
END $$;