DROP VIEW IF EXISTS public.vw_pop_diario CASCADE;

CREATE VIEW public.vw_pop_diario
WITH (security_invoker = true) AS
WITH
  turnos AS (
    SELECT * FROM (VALUES
      ('ALMOCO'::text, TIME '12:00', TIME '15:00'),
      ('JANTAR'::text, TIME '19:00', TIME '22:00')
    ) AS t(turno, win_start, win_end)
  ),
  escalados AS (
    SELECT
      s.schedule_date, s.sector_id, e.unit_id,
      CASE WHEN COALESCE(s.start_time, sh.start_time) < TIME '17:00'
           THEN 'ALMOCO' ELSE 'JANTAR' END AS turno,
      s.employee_id, e.name AS employee_name,
      e.phone AS employee_phone,
      COALESCE(s.start_time, sh.start_time) AS start_time,
      COALESCE(s.end_time,   sh.end_time)   AS end_time
    FROM public.schedules s
    JOIN public.employees e ON e.id = s.employee_id
    LEFT JOIN public.shifts sh ON sh.id = s.shift_id
    WHERE s.status <> 'cancelled'
      AND s.schedule_type::text = 'working'
      AND e.active = TRUE
      AND e.worker_type = 'clt'
  ),
  punches_ordenados AS (
    SELECT
      tp.employee_id, tp.unit_id,
      (tp.punch_ts AT TIME ZONE 'America/Sao_Paulo')::date AS d,
      (tp.punch_ts AT TIME ZONE 'America/Sao_Paulo')::time AS t,
      tp.punch_type,
      ROW_NUMBER() OVER (
        PARTITION BY tp.employee_id,
                     (tp.punch_ts AT TIME ZONE 'America/Sao_Paulo')::date
        ORDER BY tp.punch_ts
      ) AS rn
    FROM public.time_punches tp
    WHERE tp.employee_id IS NOT NULL
  ),
  jornadas AS (
    SELECT
      p1.employee_id, p1.unit_id, p1.d,
      p1.t AS entrada,
      LEAD(p1.t) OVER (PARTITION BY p1.employee_id, p1.d
                       ORDER BY p1.rn) AS saida
    FROM punches_ordenados p1
    WHERE p1.punch_type IN ('entrada','retorno')
  ),
  presentes AS (
    SELECT DISTINCT
      j.employee_id, j.unit_id, j.d AS schedule_date, t.turno
    FROM jornadas j
    CROSS JOIN turnos t
    WHERE j.saida IS NOT NULL
      AND EXTRACT(EPOCH FROM (
        LEAST(j.saida, t.win_end) - GREATEST(j.entrada, t.win_start)
      )) >= 7200
  ),
  primeira_batida AS (
    SELECT employee_id, d AS schedule_date,
           MIN(t) AS punch_in_min
    FROM punches_ordenados
    WHERE punch_type = 'entrada'
    GROUP BY employee_id, d
  ),
  -- ============================================================
  -- ETAPA C — detecção de freelancer (gambiarra documentada)
  -- Conta freelancers que bateram ponto >=2h na janela do turno.
  -- Atribui CADA freelancer ao "primeiro" setor (menor sector_id)
  -- com escalados>0 daquela unidade-turno-data, para que SUM no
  -- nível setor da view continue batendo com total real.
  -- Refinar quando freelancer tiver sector_id explícito.
  -- ============================================================
  freelancers_presentes AS (
    SELECT DISTINCT
      j.employee_id, j.unit_id, j.d AS schedule_date, t.turno
    FROM jornadas j
    JOIN public.employees e ON e.id = j.employee_id
    CROSS JOIN turnos t
    WHERE e.worker_type = 'freelancer'
      AND e.active = TRUE
      AND j.saida IS NOT NULL
      AND EXTRACT(EPOCH FROM (
        LEAST(j.saida, t.win_end) - GREATEST(j.entrada, t.win_start)
      )) >= 7200
  ),
  pick_sector AS (
    SELECT DISTINCT ON (unit_id, schedule_date, turno)
      unit_id, schedule_date, turno, sector_id
    FROM escalados
    ORDER BY unit_id, schedule_date, turno, sector_id
  ),
  freelancer_attrib AS (
    SELECT
      fp.unit_id, fp.schedule_date, fp.turno,
      ps.sector_id,
      fp.employee_id,
      e.name AS employee_name,
      pb.punch_in_min
    FROM freelancers_presentes fp
    JOIN pick_sector ps
      ON ps.unit_id = fp.unit_id
     AND ps.schedule_date = fp.schedule_date
     AND ps.turno = fp.turno
    JOIN public.employees e ON e.id = fp.employee_id
    LEFT JOIN primeira_batida pb
      ON pb.employee_id = fp.employee_id
     AND pb.schedule_date = fp.schedule_date
  ),
  pop_min AS (
    SELECT
      p.unit_id, p.sector_id,
      CASE p.dia_semana
        WHEN 'SEG' THEN 1 WHEN 'TER' THEN 2 WHEN 'QUA' THEN 3
        WHEN 'QUI' THEN 4 WHEN 'SEX' THEN 5 WHEN 'SAB' THEN 6
        WHEN 'DOM' THEN 0
      END AS dow,
      p.refeicao::text AS turno,
      p.quantidade_minima AS pop_minimo
    FROM public.pop_minimo_padrao p
    WHERE p.vigente_ate IS NULL
  ),
  datas AS (
    SELECT DISTINCT schedule_date
    FROM public.schedules
    WHERE schedule_date BETWEEN CURRENT_DATE - 30
                            AND CURRENT_DATE + 14
  ),
  slots_com_pop AS (
    SELECT
      s.id AS sector_id, s.unit_id, d.schedule_date,
      t.turno, pm.pop_minimo,
      false AS sem_pop
    FROM public.sectors s
    CROSS JOIN datas d
    CROSS JOIN turnos t
    JOIN pop_min pm
      ON pm.sector_id = s.id
     AND pm.unit_id   = s.unit_id
     AND pm.dow       = EXTRACT(DOW FROM d.schedule_date)::int
     AND pm.turno     = t.turno
  ),
  slots_sem_pop AS (
    SELECT DISTINCT
      esc.sector_id, esc.unit_id, esc.schedule_date,
      esc.turno,
      0 AS pop_minimo,
      true AS sem_pop
    FROM escalados esc
    WHERE NOT EXISTS (
      SELECT 1 FROM slots_com_pop scp
      WHERE scp.sector_id    = esc.sector_id
        AND scp.unit_id      = esc.unit_id
        AND scp.schedule_date = esc.schedule_date
        AND scp.turno        = esc.turno
    )
  ),
  slots AS (
    SELECT * FROM slots_com_pop
    UNION ALL
    SELECT * FROM slots_sem_pop
  )
SELECT
  sl.unit_id,
  sl.sector_id,
  sl.schedule_date,
  sl.turno,
  sl.pop_minimo,
  sl.sem_pop,
  COUNT(DISTINCT esc.employee_id)
    FILTER (WHERE esc.employee_id IS NOT NULL) AS escalados,
  COUNT(DISTINCT pr.employee_id)
    FILTER (WHERE pr.employee_id IS NOT NULL) AS presentes,
  COUNT(DISTINCT pr.employee_id)
    FILTER (WHERE pr.employee_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM escalados e2
              WHERE e2.employee_id   = pr.employee_id
                AND e2.sector_id     = sl.sector_id
                AND e2.schedule_date = sl.schedule_date
                AND e2.turno         = sl.turno
            )) AS pop_chegou,
  jsonb_agg(DISTINCT jsonb_build_object(
    'employee_id', esc.employee_id,
    'name', esc.employee_name,
    'phone', esc.employee_phone,
    'start', esc.start_time,
    'end',   esc.end_time,
    'punch_in', pb.punch_in_min,
    'atraso_min',
      CASE
        WHEN pb.punch_in_min IS NOT NULL
         AND esc.start_time IS NOT NULL
        THEN GREATEST(
          0,
          EXTRACT(EPOCH FROM (pb.punch_in_min - esc.start_time))::int / 60
        )
        ELSE NULL
      END
  )) FILTER (WHERE esc.employee_id IS NOT NULL) AS escalados_lista,
  jsonb_agg(DISTINCT jsonb_build_object(
    'employee_id', pr.employee_id,
    'punch_in',    pb2.punch_in_min
  )) FILTER (WHERE pr.employee_id IS NOT NULL) AS presentes_lista,
  (COUNT(DISTINCT esc.employee_id)
    FILTER (WHERE esc.employee_id IS NOT NULL)
   - COUNT(DISTINCT pr.employee_id)
    FILTER (WHERE pr.employee_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM escalados e2
              WHERE e2.employee_id   = pr.employee_id
                AND e2.sector_id     = sl.sector_id
                AND e2.schedule_date = sl.schedule_date
                AND e2.turno         = sl.turno
            ))
  ) AS faltantes,
  COUNT(DISTINCT fa.employee_id)
    FILTER (WHERE fa.employee_id IS NOT NULL) AS extras_freelancer,
  jsonb_agg(DISTINCT jsonb_build_object(
    'employee_id', fa.employee_id,
    'name',        fa.employee_name,
    'punch_in',    fa.punch_in_min,
    'tipo',        'freelancer'
  )) FILTER (WHERE fa.employee_id IS NOT NULL) AS extras_lista,
  CASE
    WHEN sl.sem_pop THEN 0
    ELSE sl.pop_minimo
       - COUNT(DISTINCT pr.employee_id) FILTER (
           WHERE pr.employee_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM escalados e2
             WHERE e2.employee_id   = pr.employee_id
               AND e2.sector_id     = sl.sector_id
               AND e2.schedule_date = sl.schedule_date
               AND e2.turno         = sl.turno
           ))
  END AS saldo_final,
  CASE
    WHEN sl.sem_pop THEN 'sem_pop'
    WHEN sl.schedule_date = CURRENT_DATE
     AND (CURRENT_TIME AT TIME ZONE 'America/Sao_Paulo')::time
         < (SELECT win_start FROM turnos WHERE turno = sl.turno)
      THEN 'aguardando'
    WHEN sl.pop_minimo
       - COUNT(DISTINCT pr.employee_id) FILTER (
           WHERE pr.employee_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM escalados e2
             WHERE e2.employee_id   = pr.employee_id
               AND e2.sector_id     = sl.sector_id
               AND e2.schedule_date = sl.schedule_date
               AND e2.turno         = sl.turno
           )) <= 0
      THEN 'conforme'
    ELSE 'inconforme'
  END AS status,
  (sl.schedule_date = CURRENT_DATE
   AND (CURRENT_TIME AT TIME ZONE 'America/Sao_Paulo')::time
       >= (SELECT win_start FROM turnos WHERE turno = sl.turno)) AS janela_iniciada,
  (sl.schedule_date = CURRENT_DATE
   AND (CURRENT_TIME AT TIME ZONE 'America/Sao_Paulo')::time
       >= (SELECT win_end FROM turnos WHERE turno = sl.turno))   AS janela_encerrada,
  NOW() AS computed_at
FROM slots sl
LEFT JOIN escalados esc
  ON esc.sector_id     = sl.sector_id
 AND esc.schedule_date = sl.schedule_date
 AND esc.turno         = sl.turno
 AND esc.unit_id       = sl.unit_id
LEFT JOIN presentes pr
  ON pr.employee_id    = esc.employee_id
 AND pr.schedule_date  = sl.schedule_date
 AND pr.turno          = sl.turno
 AND pr.unit_id        = sl.unit_id
LEFT JOIN primeira_batida pb
  ON pb.employee_id    = esc.employee_id
 AND pb.schedule_date  = sl.schedule_date
LEFT JOIN primeira_batida pb2
  ON pb2.employee_id   = pr.employee_id
 AND pb2.schedule_date = sl.schedule_date
LEFT JOIN freelancer_attrib fa
  ON fa.unit_id       = sl.unit_id
 AND fa.sector_id     = sl.sector_id
 AND fa.schedule_date = sl.schedule_date
 AND fa.turno         = sl.turno
GROUP BY sl.unit_id, sl.sector_id, sl.schedule_date,
         sl.turno, sl.pop_minimo, sl.sem_pop;

GRANT SELECT ON public.vw_pop_diario TO authenticated;