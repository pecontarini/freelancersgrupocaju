
DO $$
DECLARE
  v_unit uuid := 'e2ad5403-dcfb-4a70-a9cc-15106bb348f5';
  s_asg_keep uuid := '61225a69-3875-4cb5-ba6f-cb8a39dab454';
  s_asg_drop uuid := '2ad4fa91-5669-40d4-8a29-f5bcdaf635e3';
  s_cop_keep uuid := '83446b18-66d0-4620-aa5f-fad595cae7a4'; -- COPEIRAS
  s_cop_drop uuid := 'bf1b6663-1863-4969-ba4e-c43dd731c3b4'; -- COPEIRO(A)
  s_coz_keep uuid := 'bb536e9b-7acc-493a-8f17-76e0ff4515dd'; -- COZINHA
  s_coz_drop uuid := '11d465e5-1901-4510-baa4-b1328bffc18b'; -- AUXILIAR DE COZINHA
  s_est_keep uuid := 'cd6259ba-4980-4927-835b-4c499c24e1bf'; -- ESTOQUE
  s_est_drop uuid := 'abcf5c0a-2424-4a5a-b91a-522e2186c126'; -- ESTOQUISTA
  s_tec_keep uuid := '480f0359-1181-4b5a-a55c-4794aa82690f'; -- TÉC NUTRIÇÃO
  s_tec_drop uuid := '3ec6b7e3-01cc-4414-b82a-0a4859242877'; -- TECNICO DE NUTRIÇÃO
  jt_concierge_keep uuid := '27a87b9e-f438-418e-a14f-b44fbcf9da0b'; -- CONCIERGE
  jt_concierge_drop uuid := 'faeb5075-986e-4639-845b-f2052a067f4d'; -- Concierge
  _pair record;
BEGIN
  -- 1. Dedup sectors: move mappings from drop -> keep, then delete drop
  FOR _pair IN
    SELECT * FROM (VALUES
      (s_asg_drop, s_asg_keep),
      (s_cop_drop, s_cop_keep),
      (s_coz_drop, s_coz_keep),
      (s_est_drop, s_est_keep),
      (s_tec_drop, s_tec_keep)
    ) AS t(drop_id, keep_id)
  LOOP
    -- move sector_job_titles (avoid unique conflict)
    UPDATE public.sector_job_titles sjt
    SET sector_id = _pair.keep_id
    WHERE sjt.sector_id = _pair.drop_id
      AND NOT EXISTS (
        SELECT 1 FROM public.sector_job_titles x
        WHERE x.sector_id = _pair.keep_id AND x.job_title_id = sjt.job_title_id
      );
    DELETE FROM public.sector_job_titles WHERE sector_id = _pair.drop_id;
    DELETE FROM public.sectors WHERE id = _pair.drop_id;
  END LOOP;

  -- 2. Dedup job title Concierge -> CONCIERGE
  UPDATE public.employees SET job_title_id = jt_concierge_keep
   WHERE job_title_id = jt_concierge_drop;
  UPDATE public.sector_job_titles sjt
     SET job_title_id = jt_concierge_keep
   WHERE job_title_id = jt_concierge_drop
     AND NOT EXISTS (
       SELECT 1 FROM public.sector_job_titles x
        WHERE x.sector_id = sjt.sector_id AND x.job_title_id = jt_concierge_keep
     );
  DELETE FROM public.sector_job_titles WHERE job_title_id = jt_concierge_drop;
  DELETE FROM public.job_titles WHERE id = jt_concierge_drop;

  -- Normalize Garçom -> GARÇOM
  UPDATE public.job_titles SET name = 'GARÇOM'
   WHERE unit_id = v_unit AND name = 'Garçom';

  -- 3. Backfill missing job_title_id on employees using job_title text (case-insensitive)
  UPDATE public.employees e
     SET job_title_id = jt.id
    FROM public.job_titles jt
   WHERE e.unit_id = v_unit
     AND e.job_title_id IS NULL
     AND e.job_title IS NOT NULL
     AND jt.unit_id = v_unit
     AND lower(trim(jt.name)) = lower(trim(e.job_title));

  -- 4. Auto-link job titles to sectors (idempotent)
  INSERT INTO public.sector_job_titles (sector_id, job_title_id)
  SELECT s.id, jt.id
  FROM public.sectors s
  JOIN public.job_titles jt ON jt.unit_id = v_unit
  WHERE s.unit_id = v_unit
    AND (
      (s.name = 'ADM' AND jt.name IN ('CONCIERGE','SUPERVISOR DE CONCIERGE','QR CODE','TASY','COORDENADOR'))
   OR (s.name = 'ADMINISTRATIVO' AND jt.name IN ('ADMINISTRATIVO','AUXILIAR ADMINISTRATIVO','ENCARREGADO'))
   OR (s.name = 'ASG' AND jt.name IN ('LIMPEZA GERAL','PANELAS'))
   OR (s.name = 'AUXILIAR DE SERVIÇOS GERAIS' AND jt.name IN ('LIMPEZA GERAL','PANELAS'))
   OR (s.name = 'COZINHA' AND jt.name IN ('COZINHEIRO(A) HOSPITALAR','AUXILIAR DO COZINHEIRO','AUXILIAR DE COZINHA - DIETÉTICA','SALADEIRA','COLAÇÃO','CONFEITEIRA','SUPERVISORA DE PRODUÇÃO'))
   OR (s.name = 'COPEIRAS' AND jt.name IN ('COPEIRO(A) HOSPITALAR','COPEIRA (AVIÃO)','GARÇOM','LACTARISTA','LÁCTARIO','1º ANDAR - HCBR','TERREO E 2º ANDAR - HCBR','CLINICA MEDICA E UCCA','DAY CLINIC','MATERNIDADE E ESTAR MEDICO','UTI ADULTO E CIRURGICA','UTI ONCO + TMO','UTI PED','UTI TERREA + EMERGENCIA'))
   OR (s.name = 'ESTOQUE' AND jt.name IN ('ESTOQUE','AUXILIAR DE ESTOQUE'))
   OR (s.name = 'NUTRICIONISTA' AND jt.name = 'NUTRIÇÃO')
   OR (s.name = 'TÉC NUTRIÇÃO' AND jt.name IN ('COZINHA - TÉC NUTRIÇÃO','LÁCTARIO'))
    )
  ON CONFLICT DO NOTHING;
END $$;
