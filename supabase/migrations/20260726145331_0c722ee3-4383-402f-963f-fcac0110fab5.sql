
DO $$
DECLARE
  v_unit uuid := 'e2ad5403-dcfb-4a70-a9cc-15106bb348f5';
BEGIN
  -- Ensure needed job titles exist
  INSERT INTO public.job_titles (unit_id, name)
  SELECT v_unit, n FROM (VALUES
    ('AUXILIAR ADMINISTRATIVO'),
    ('AUXILIAR DE COZINHA'),
    ('AUXILIAR DE SERVIÇOS GERAIS'),
    ('NUTRICIONISTA'),
    ('TECNICO DE NUTRIÇÃO')
  ) v(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.job_titles jt
    WHERE jt.unit_id = v_unit AND lower(trim(jt.name)) = lower(trim(v.n))
  );

  -- Backfill orphan employees (retry now that all titles exist)
  UPDATE public.employees e
     SET job_title_id = jt.id
    FROM public.job_titles jt
   WHERE e.unit_id = v_unit
     AND e.active
     AND e.job_title_id IS NULL
     AND e.job_title IS NOT NULL
     AND jt.unit_id = v_unit
     AND lower(trim(jt.name)) = lower(trim(e.job_title));

  -- Link the new job titles to the appropriate sectors
  INSERT INTO public.sector_job_titles (sector_id, job_title_id)
  SELECT s.id, jt.id
  FROM public.sectors s
  JOIN public.job_titles jt ON jt.unit_id = v_unit
  WHERE s.unit_id = v_unit
    AND (
      (s.name = 'ADMINISTRATIVO' AND jt.name = 'AUXILIAR ADMINISTRATIVO')
   OR (s.name = 'COZINHA' AND jt.name = 'AUXILIAR DE COZINHA')
   OR (s.name = 'ASG' AND jt.name = 'AUXILIAR DE SERVIÇOS GERAIS')
   OR (s.name = 'AUXILIAR DE SERVIÇOS GERAIS' AND jt.name = 'AUXILIAR DE SERVIÇOS GERAIS')
   OR (s.name = 'NUTRICIONISTA' AND jt.name = 'NUTRICIONISTA')
   OR (s.name = 'TÉC NUTRIÇÃO' AND jt.name IN ('TECNICO DE NUTRIÇÃO','TÉC NUTRIÇÃO'))
   OR (s.name = 'GARÇOM' AND jt.name = 'GARÇOM')
    )
  ON CONFLICT DO NOTHING;
END $$;
