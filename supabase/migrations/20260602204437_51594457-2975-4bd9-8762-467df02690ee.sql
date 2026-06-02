
-- =========================================================================
-- Etapa A — POP Diário Unificado (correção: schedules não tem unit_id)
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_schedules_date_status
  ON public.schedules (schedule_date, status) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_schedules_sector_date
  ON public.schedules (sector_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_employees_unit_active_worker
  ON public.employees (unit_id, active, worker_type);
CREATE INDEX IF NOT EXISTS idx_schedule_attendance_date
  ON public.schedule_attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_extras_checkins_unit_ts
  ON public.extras_checkins (unit_id, checkin_ts);

DROP VIEW IF EXISTS public.vw_pop_diario CASCADE;

CREATE VIEW public.vw_pop_diario
WITH (security_invoker = true)
AS
WITH
turnos(turno, win_start, win_end) AS (
  VALUES
    ('ALMOCO'::text, TIME '12:00', TIME '15:00'),
    ('JANTAR'::text, TIME '19:00', TIME '22:00')
),
dow_map(dia_enum, dow) AS (
  VALUES
    ('SEG'::pop_dia_semana_enum, 1),
    ('TER'::pop_dia_semana_enum, 2),
    ('QUA'::pop_dia_semana_enum, 3),
    ('QUI'::pop_dia_semana_enum, 4),
    ('SEX'::pop_dia_semana_enum, 5),
    ('SAB'::pop_dia_semana_enum, 6),
    ('DOM'::pop_dia_semana_enum, 0)
),
pop_min AS (
  SELECT
    p.unit_id, p.sector_id,
    dm.dow,
    p.refeicao::text AS turno,
    p.quantidade_minima AS pop_minimo
  FROM public.pop_minimo_padrao p
  JOIN dow_map dm ON dm.dia_enum = p.dia_semana
  WHERE p.vigente_ate IS NULL
),
slots AS (
  SELECT
    pm.unit_id, pm.sector_id,
    d::date AS schedule_date,
    pm.turno,
    pm.pop_minimo
  FROM pop_min pm
  CROSS JOIN generate_series(
    (current_date - INTERVAL '30 days')::date,
    (current_date + INTERVAL '7 days')::date,
    '1 day'::interval
  ) AS d
  WHERE pm.dow = EXTRACT(DOW FROM d)::int
),
-- ESCALADOS: CLT ativos, schedule não-cancelado.
-- unidade vem de employees.unit_id (Fase B garantiu integridade).
escalados AS (
  SELECT
    s.schedule_date,
    s.sector_id,
    e.unit_id,
    CASE
      WHEN COALESCE(s.start_time, sh.start_time) < TIME '17:00' THEN 'ALMOCO'
      ELSE 'JANTAR'
    END AS turno,
    s.employee_id,
    e.name  AS employee_name,
    e.phone AS employee_phone,
    COALESCE(s.start_time, sh.start_time) AS start_time,
    COALESCE(s.end_time,   sh.end_time)   AS end_time
  FROM public.schedules s
  JOIN public.employees e  ON e.id  = s.employee_id
  LEFT JOIN public.shifts sh ON sh.id = s.shift_id
  WHERE s.status <> 'cancelled'
    AND s.schedule_type::text = 'working'
    AND e.active = TRUE
    AND e.worker_type = 'clt'
    AND s.schedule_date BETWEEN (current_date - INTERVAL '30 days')::date
                            AND (current_date + INTERVAL '7 days')::date
),
punches_ord AS (
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
    AND tp.punch_ts >= (current_date - INTERVAL '31 days')::timestamptz
),
jornadas AS (
  SELECT
    employee_id, unit_id, d,
    t AS entrada,
    LEAD(t) OVER (PARTITION BY employee_id, d ORDER BY rn) AS saida
  FROM punches_ord
  WHERE punch_type::text IN ('entrada','retorno')
),
-- PRESENÇA: POP 02 §5.2.4 — UM trecho contínuo (entrada→saida ou retorno→saida)
-- com sobreposição >= 7200s (2h) na janela do turno. Soma de trechos NÃO conta.
presentes AS (
  SELECT DISTINCT
    j.employee_id, j.unit_id,
    j.d AS schedule_date,
    t.turno
  FROM jornadas j
  CROSS JOIN turnos t
  WHERE j.saida IS NOT NULL
    AND EXTRACT(EPOCH FROM (LEAST(j.saida, t.win_end) - GREATEST(j.entrada, t.win_start))) >= 7200
),
extras_freelancer AS (
  SELECT
    ec.unit_id, ec.sector_id,
    (ec.checkin_ts AT TIME ZONE 'America/Sao_Paulo')::date AS schedule_date,
    CASE
      WHEN (ec.checkin_ts AT TIME ZONE 'America/Sao_Paulo')::time < TIME '17:00' THEN 'ALMOCO'
      ELSE 'JANTAR'
    END AS turno,
    ec.id AS extra_id,
    ec.nome_freelancer AS employee_name
  FROM public.extras_checkins ec
  WHERE ec.checkout_ts IS NOT NULL
    AND ec.sector_id IS NOT NULL
    AND EXTRACT(EPOCH FROM (ec.checkout_ts - ec.checkin_ts)) >= 7200
),
agg_escalados AS (
  SELECT sector_id, schedule_date, turno, unit_id,
    COUNT(DISTINCT employee_id) AS n,
    jsonb_agg(DISTINCT jsonb_build_object(
      'employee_id', employee_id,
      'name',        employee_name,
      'phone',       employee_phone,
      'start',       start_time,
      'end',         end_time
    )) AS lista
  FROM escalados
  GROUP BY sector_id, schedule_date, turno, unit_id
),
agg_pop_chegou AS (
  SELECT e.sector_id, e.schedule_date, e.turno, e.unit_id,
    COUNT(DISTINCT e.employee_id) AS n,
    jsonb_agg(DISTINCT jsonb_build_object(
      'employee_id', e.employee_id,
      'name',        e.employee_name,
      'phone',       e.employee_phone
    )) AS lista
  FROM escalados e
  JOIN presentes p
    ON p.employee_id = e.employee_id
   AND p.schedule_date = e.schedule_date
   AND p.turno = e.turno
   AND p.unit_id = e.unit_id
  GROUP BY e.sector_id, e.schedule_date, e.turno, e.unit_id
),
agg_faltantes AS (
  SELECT e.sector_id, e.schedule_date, e.turno, e.unit_id,
    COUNT(DISTINCT e.employee_id) AS n,
    jsonb_agg(DISTINCT jsonb_build_object(
      'employee_id', e.employee_id,
      'name',        e.employee_name,
      'phone',       e.employee_phone
    )) AS lista
  FROM escalados e
  WHERE NOT EXISTS (
    SELECT 1 FROM presentes p
    WHERE p.employee_id   = e.employee_id
      AND p.schedule_date = e.schedule_date
      AND p.turno         = e.turno
      AND p.unit_id       = e.unit_id
  )
  GROUP BY e.sector_id, e.schedule_date, e.turno, e.unit_id
),
agg_extras_free AS (
  SELECT sector_id, schedule_date, turno, unit_id,
    COUNT(*) AS n,
    jsonb_agg(jsonb_build_object(
      'extra_id', extra_id,
      'name',     employee_name,
      'tipo',     'freelancer'
    )) AS lista
  FROM extras_freelancer
  GROUP BY sector_id, schedule_date, turno, unit_id
)
SELECT
  sl.unit_id,
  sl.sector_id,
  sl.schedule_date,
  sl.turno,
  sl.pop_minimo,

  COALESCE(ae.n, 0)               AS escalados,
  COALESCE(ae.lista, '[]'::jsonb) AS escalados_lista,

  COALESCE(apc.n, 0)               AS pop_chegou,
  COALESCE(apc.lista, '[]'::jsonb) AS pop_chegou_lista,

  (COALESCE(apc.n, 0) + COALESCE(aef.n, 0)) AS presentes,
  (COALESCE(apc.lista, '[]'::jsonb) || COALESCE(aef.lista, '[]'::jsonb)) AS presentes_lista,

  COALESCE(af.n, 0)               AS faltantes,
  COALESCE(af.lista, '[]'::jsonb) AS faltantes_lista,

  COALESCE(aef.n, 0)              AS extras_freelancer,
  0::int                          AS extras_dobra,
  COALESCE(aef.lista, '[]'::jsonb) AS extras_lista,

  (sl.pop_minimo - COALESCE(apc.n, 0) - COALESCE(aef.n, 0)) AS saldo_final,

  CASE
    WHEN sl.schedule_date > current_date THEN 'aguardando'
    WHEN sl.schedule_date = current_date
      AND (now() AT TIME ZONE 'America/Sao_Paulo')::time
          < (SELECT win_start FROM turnos WHERE turno = sl.turno)
      THEN 'aguardando'
    WHEN (sl.pop_minimo - COALESCE(apc.n, 0) - COALESCE(aef.n, 0)) > 0 THEN 'inconforme'
    ELSE 'conforme'
  END AS status,

  (sl.schedule_date < current_date
   OR (sl.schedule_date = current_date
       AND (now() AT TIME ZONE 'America/Sao_Paulo')::time
           >= (SELECT win_start FROM turnos WHERE turno = sl.turno))) AS janela_iniciada,

  (sl.schedule_date < current_date
   OR (sl.schedule_date = current_date
       AND (now() AT TIME ZONE 'America/Sao_Paulo')::time
           >= (SELECT win_end FROM turnos WHERE turno = sl.turno))) AS janela_encerrada,

  now() AS computed_at

FROM slots sl
LEFT JOIN agg_escalados   ae  ON ae.sector_id = sl.sector_id  AND ae.schedule_date  = sl.schedule_date AND ae.turno  = sl.turno AND ae.unit_id  = sl.unit_id
LEFT JOIN agg_pop_chegou  apc ON apc.sector_id = sl.sector_id AND apc.schedule_date = sl.schedule_date AND apc.turno = sl.turno AND apc.unit_id = sl.unit_id
LEFT JOIN agg_faltantes   af  ON af.sector_id = sl.sector_id  AND af.schedule_date  = sl.schedule_date AND af.turno  = sl.turno AND af.unit_id  = sl.unit_id
LEFT JOIN agg_extras_free aef ON aef.sector_id = sl.sector_id AND aef.schedule_date = sl.schedule_date AND aef.turno = sl.turno AND aef.unit_id = sl.unit_id;

COMMENT ON VIEW public.vw_pop_diario IS
  'Contrato canônico POP Diário. 1 linha por (unit, sector, date, turno) onde existe POP vigente. '
  'Presença = trecho contínuo >=2h sobreposto à janela 12-15 (almoço) ou 19-22 (jantar). '
  'Remanejado fora de escopo nesta fase. Fonte de POP: pop_minimo_padrao apenas.';

DROP VIEW IF EXISTS public.vw_pop_setores_sem_cobertura CASCADE;

CREATE VIEW public.vw_pop_setores_sem_cobertura
WITH (security_invoker = true)
AS
SELECT
  s.unit_id,
  cl.nome AS unit_name,
  s.id    AS sector_id,
  s.name  AS sector_name
FROM public.sectors s
JOIN public.config_lojas cl ON cl.id = s.unit_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.pop_minimo_padrao p
  WHERE p.sector_id = s.id
    AND p.vigente_ate IS NULL
);

COMMENT ON VIEW public.vw_pop_setores_sem_cobertura IS
  'Setores sem POP mínimo vigente em pop_minimo_padrao. Insumo para futuro Painel de Auditoria de POP.';

GRANT SELECT ON public.vw_pop_diario              TO authenticated;
GRANT SELECT ON public.vw_pop_diario              TO service_role;
GRANT SELECT ON public.vw_pop_setores_sem_cobertura TO authenticated;
GRANT SELECT ON public.vw_pop_setores_sem_cobertura TO service_role;
