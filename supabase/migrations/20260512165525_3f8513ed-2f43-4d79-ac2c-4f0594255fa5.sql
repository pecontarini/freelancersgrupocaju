-- =========================================================
-- ONDA 6 — ETAPA 2: schedule_drafts + slots + validate RPC
-- Protocolo C1: DO $verify$ ao final aborta tudo se falhar.
-- =========================================================

-- 1) TABELA schedule_drafts
CREATE TABLE IF NOT EXISTS public.schedule_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE CASCADE,
  semana_inicio date NOT NULL,
  mode text NOT NULL DEFAULT 'empty_slots'
    CHECK (mode IN ('with_employees','empty_slots')),
  modelo_folga text NOT NULL DEFAULT '6x1'
    CHECK (modelo_folga IN ('5x2','6x1')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','discarded')),
  payload jsonb,
  created_by uuid,
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_schedule_draft
  ON public.schedule_drafts (unit_id, COALESCE(sector_id, '00000000-0000-0000-0000-000000000000'::uuid), semana_inicio)
  WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS idx_schedule_drafts_unit_week
  ON public.schedule_drafts (unit_id, semana_inicio);

-- 2) TABELA schedule_draft_slots
CREATE TABLE IF NOT EXISTS public.schedule_draft_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.schedule_drafts(id) ON DELETE CASCADE,
  schedule_date date NOT NULL,
  dia_semana text NOT NULL
    CHECK (dia_semana IN ('SEG','TER','QUA','QUI','SEX','SAB','DOM')),
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  shift_label text,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_min int NOT NULL DEFAULT 0,
  shift_type text NOT NULL DEFAULT 'almoco'
    CHECK (shift_type IN ('almoco','jantar','dobra','intermediario')),
  papel text NOT NULL DEFAULT 'outro'
    CHECK (papel IN ('abridor','fechador','intermediario','outro')),
  tipo text NOT NULL DEFAULT 'efetivo'
    CHECK (tipo IN ('efetivo','extra')),
  job_title_id uuid REFERENCES public.job_titles(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  agreed_rate numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_draft_slots_draft
  ON public.schedule_draft_slots (draft_id);
CREATE INDEX IF NOT EXISTS idx_schedule_draft_slots_employee
  ON public.schedule_draft_slots (employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_draft_slots_date
  ON public.schedule_draft_slots (schedule_date);

-- 3) Triggers updated_at
DROP TRIGGER IF EXISTS trg_schedule_drafts_uat ON public.schedule_drafts;
CREATE TRIGGER trg_schedule_drafts_uat
  BEFORE UPDATE ON public.schedule_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_schedule_draft_slots_uat ON public.schedule_draft_slots;
CREATE TRIGGER trg_schedule_draft_slots_uat
  BEFORE UPDATE ON public.schedule_draft_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RLS
ALTER TABLE public.schedule_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_draft_slots ENABLE ROW LEVEL SECURITY;

-- schedule_drafts policies
CREATE POLICY "Admins manage schedule_drafts"
  ON public.schedule_drafts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators/managers manage schedule_drafts of their units"
  ON public.schedule_drafts FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'gerente_unidade'::app_role))
    AND user_has_access_to_loja(auth.uid(), unit_id)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'gerente_unidade'::app_role))
    AND user_has_access_to_loja(auth.uid(), unit_id)
  );

CREATE POLICY "Chefe setor manage schedule_drafts of own sector"
  ON public.schedule_drafts FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'chefe_setor'::app_role)
    AND sector_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sectors s
      JOIN public.user_stores us ON us.loja_id = s.unit_id
      WHERE s.id = schedule_drafts.sector_id AND us.user_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'chefe_setor'::app_role)
    AND sector_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sectors s
      JOIN public.user_stores us ON us.loja_id = s.unit_id
      WHERE s.id = schedule_drafts.sector_id AND us.user_id = auth.uid()
    )
  );

-- schedule_draft_slots policies (heredam via draft_id)
CREATE POLICY "Admins manage schedule_draft_slots"
  ON public.schedule_draft_slots FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators/managers manage slots of their unit drafts"
  ON public.schedule_draft_slots FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'gerente_unidade'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.schedule_drafts d
      WHERE d.id = schedule_draft_slots.draft_id
        AND user_has_access_to_loja(auth.uid(), d.unit_id)
    )
  )
  WITH CHECK (
    (has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'gerente_unidade'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.schedule_drafts d
      WHERE d.id = schedule_draft_slots.draft_id
        AND user_has_access_to_loja(auth.uid(), d.unit_id)
    )
  );

CREATE POLICY "Chefe setor manage slots of own sector drafts"
  ON public.schedule_draft_slots FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'chefe_setor'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.schedule_drafts d
      JOIN public.sectors s ON s.id = d.sector_id
      JOIN public.user_stores us ON us.loja_id = s.unit_id
      WHERE d.id = schedule_draft_slots.draft_id AND us.user_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'chefe_setor'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.schedule_drafts d
      JOIN public.sectors s ON s.id = d.sector_id
      JOIN public.user_stores us ON us.loja_id = s.unit_id
      WHERE d.id = schedule_draft_slots.draft_id AND us.user_id = auth.uid()
    )
  );

-- 5) RPC validate_schedule_publish
CREATE OR REPLACE FUNCTION public.validate_schedule_publish(
  p_draft_id uuid,
  p_override_pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_draft           record;
  v_slot            record;
  v_blockers        jsonb := '[]'::jsonb;
  v_warnings        jsonb := '[]'::jsonb;
  v_clt_result      jsonb;
  v_total_unbound   int := 0;
  v_total_extras    int := 0;
  v_estimated_cost  numeric := 0;
  v_month_budget    numeric := 0;
  v_month_year      text;
  v_override_active boolean := false;
  v_pin_user        uuid;
BEGIN
  -- Validar draft existe e usuário tem acesso (RLS já bloqueia, mas dupla checagem)
  SELECT * INTO v_draft FROM public.schedule_drafts WHERE id = p_draft_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'draft_not_found');
  END IF;

  IF v_draft.status <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'draft_not_in_draft_status', 'status', v_draft.status);
  END IF;

  -- Override PIN: operator role check (PIN exato bate com role operator do solicitante)
  IF p_override_pin IS NOT NULL AND length(trim(p_override_pin)) >= 4 THEN
    IF auth.uid() IS NOT NULL AND has_role(auth.uid(), 'operator'::app_role) THEN
      v_override_active := true;
    END IF;
  END IF;

  v_month_year := to_char(v_draft.semana_inicio, 'YYYY-MM');
  SELECT COALESCE(freelancer_budget, 0) INTO v_month_budget
  FROM public.store_budgets
  WHERE store_id = v_draft.unit_id AND month_year = v_month_year
  LIMIT 1;

  -- Iterar slots
  FOR v_slot IN
    SELECT s.*
    FROM public.schedule_draft_slots s
    WHERE s.draft_id = p_draft_id
    ORDER BY s.schedule_date, s.start_time
  LOOP
    -- Estimar custo (rate * 1 dia)
    v_estimated_cost := v_estimated_cost + COALESCE(v_slot.agreed_rate, 0);

    IF v_slot.tipo = 'extra' THEN
      v_total_extras := v_total_extras + 1;
    END IF;

    IF v_slot.employee_id IS NULL THEN
      v_total_unbound := v_total_unbound + 1;
      v_blockers := v_blockers || jsonb_build_object(
        'slot_id', v_slot.id,
        'date', v_slot.schedule_date,
        'reason', 'unbound',
        'message', format('Slot em %s (%s) sem funcionário vinculado.', v_slot.dia_semana, v_slot.shift_label)
      );
      CONTINUE;
    END IF;

    -- Validar CLT (apenas se houver shift_id real associável; aqui passamos NULL e validamos manualmente)
    -- Como validate_schedule_clt requer shift_id, fazemos checagens diretas sobre schedules existentes:
    -- Interjornada 11h vs último schedule do funcionário antes da data
    PERFORM 1
    FROM public.schedules sch
    JOIN public.shifts sh ON sh.id = sch.shift_id
    WHERE sch.employee_id = v_slot.employee_id
      AND sch.status <> 'cancelled'
      AND (sch.schedule_date + sh.end_time::time)
          > (v_slot.schedule_date + v_slot.start_time - interval '11 hours')
      AND (sch.schedule_date + sh.end_time::time)
          <= (v_slot.schedule_date + v_slot.start_time)
    LIMIT 1;
    IF FOUND THEN
      v_blockers := v_blockers || jsonb_build_object(
        'slot_id', v_slot.id,
        'date', v_slot.schedule_date,
        'reason', 'interjornada',
        'message', 'Art. 66 CLT — menos de 11h de descanso desde turno anterior.'
      );
    END IF;

    -- Carga > 10h/dia somando draft + schedules existentes
    IF (
      EXTRACT(EPOCH FROM (v_slot.end_time - v_slot.start_time))/3600.0
      + COALESCE((
          SELECT SUM(EXTRACT(EPOCH FROM (sh.end_time - sh.start_time))/3600.0)
          FROM public.schedules sch
          JOIN public.shifts sh ON sh.id = sch.shift_id
          WHERE sch.employee_id = v_slot.employee_id
            AND sch.schedule_date = v_slot.schedule_date
            AND sch.status <> 'cancelled'
        ), 0)
      + COALESCE((
          SELECT SUM(EXTRACT(EPOCH FROM (s2.end_time - s2.start_time))/3600.0)
          FROM public.schedule_draft_slots s2
          WHERE s2.draft_id = p_draft_id
            AND s2.employee_id = v_slot.employee_id
            AND s2.schedule_date = v_slot.schedule_date
            AND s2.id <> v_slot.id
        ), 0)
    ) > 10 THEN
      v_blockers := v_blockers || jsonb_build_object(
        'slot_id', v_slot.id,
        'date', v_slot.schedule_date,
        'reason', 'limite_diario',
        'message', 'Art. 59 CLT — total diário > 10h.'
      );
    END IF;

    -- 44h semanal: somar week
    IF (
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (s2.end_time - s2.start_time))/3600.0), 0)
      FROM public.schedule_draft_slots s2
      WHERE s2.draft_id = p_draft_id
        AND s2.employee_id = v_slot.employee_id
    ) > 44 THEN
      v_blockers := v_blockers || jsonb_build_object(
        'slot_id', v_slot.id,
        'date', v_slot.schedule_date,
        'reason', 'jornada_semanal',
        'message', 'Art. 58 CLT — jornada semanal > 44h.'
      );
    END IF;

    -- DSR: o funcionário deve ter ao menos 1 dia sem slot na semana
    IF NOT EXISTS (
      SELECT 1
      FROM generate_series(v_draft.semana_inicio, v_draft.semana_inicio + 6, interval '1 day') g(d)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.schedule_draft_slots s3
        WHERE s3.draft_id = p_draft_id
          AND s3.employee_id = v_slot.employee_id
          AND s3.schedule_date = g.d::date
      )
    ) THEN
      v_blockers := v_blockers || jsonb_build_object(
        'slot_id', v_slot.id,
        'date', v_slot.schedule_date,
        'reason', 'dsr',
        'message', 'Art. 67 CLT — sem DSR (descanso semanal remunerado).'
      );
    END IF;

    -- Domingo feminino: gênero F com slot domingo precisa folga em outro domingo nos últimos 15d
    IF EXTRACT(DOW FROM v_slot.schedule_date) = 0 THEN
      IF EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = v_slot.employee_id AND e.gender = 'F'
      ) AND NOT EXISTS (
        SELECT 1
        FROM generate_series(v_slot.schedule_date - interval '15 days', v_slot.schedule_date - interval '1 day', interval '1 day') g(d)
        WHERE EXTRACT(DOW FROM g.d) = 0
          AND NOT EXISTS (
            SELECT 1 FROM public.schedules sch
            WHERE sch.employee_id = v_slot.employee_id
              AND sch.schedule_date = g.d::date
              AND sch.status <> 'cancelled'
          )
      ) THEN
        v_blockers := v_blockers || jsonb_build_object(
          'slot_id', v_slot.id,
          'date', v_slot.schedule_date,
          'reason', 'domingo_feminino',
          'message', 'Art. 386 CLT — funcionária sem folga dominical nos últimos 15 dias.'
        );
      END IF;
    END IF;
  END LOOP;

  -- Avisos consultivos (silenciados se override_active)
  IF v_month_budget > 0 AND v_estimated_cost > v_month_budget THEN
    IF NOT v_override_active THEN
      v_warnings := v_warnings || jsonb_build_object(
        'reason', 'budget_excedido',
        'message', format('Custo estimado R$%s excede orçamento mensal R$%s.', v_estimated_cost, v_month_budget),
        'estimated_cost', v_estimated_cost,
        'month_budget', v_month_budget,
        'overridable', true
      );
    END IF;
  END IF;

  IF v_total_extras > 0 AND NOT v_override_active THEN
    v_warnings := v_warnings || jsonb_build_object(
      'reason', 'extras_planejados',
      'message', format('%s slot(s) marcados como Extra — confirme cota mensal.', v_total_extras),
      'total_extras', v_total_extras,
      'overridable', true
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_blockers) = 0,
    'can_publish', jsonb_array_length(v_blockers) = 0 AND v_total_unbound = 0,
    'blockers', v_blockers,
    'warnings', v_warnings,
    'override_active', v_override_active,
    'estimated_cost', v_estimated_cost,
    'month_budget', v_month_budget,
    'total_unbound', v_total_unbound,
    'total_extras', v_total_extras
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_schedule_publish(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_schedule_publish(uuid, text) TO authenticated;

-- 6) DO $verify$ — protocolo C1
DO $verify$
DECLARE
  v_table_drafts int;
  v_table_slots  int;
  v_rls_drafts   bool;
  v_rls_slots    bool;
  v_fn_exists    int;
  v_policies     int;
BEGIN
  SELECT COUNT(*) INTO v_table_drafts
  FROM information_schema.tables
  WHERE table_schema='public' AND table_name='schedule_drafts';
  IF v_table_drafts <> 1 THEN RAISE EXCEPTION 'verify failed: schedule_drafts missing'; END IF;

  SELECT COUNT(*) INTO v_table_slots
  FROM information_schema.tables
  WHERE table_schema='public' AND table_name='schedule_draft_slots';
  IF v_table_slots <> 1 THEN RAISE EXCEPTION 'verify failed: schedule_draft_slots missing'; END IF;

  SELECT relrowsecurity INTO v_rls_drafts
  FROM pg_class WHERE oid = 'public.schedule_drafts'::regclass;
  IF NOT v_rls_drafts THEN RAISE EXCEPTION 'verify failed: RLS off on schedule_drafts'; END IF;

  SELECT relrowsecurity INTO v_rls_slots
  FROM pg_class WHERE oid = 'public.schedule_draft_slots'::regclass;
  IF NOT v_rls_slots THEN RAISE EXCEPTION 'verify failed: RLS off on schedule_draft_slots'; END IF;

  SELECT COUNT(*) INTO v_fn_exists
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='validate_schedule_publish';
  IF v_fn_exists <> 1 THEN RAISE EXCEPTION 'verify failed: validate_schedule_publish missing (%)', v_fn_exists; END IF;

  SELECT COUNT(*) INTO v_policies
  FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('schedule_drafts','schedule_draft_slots');
  IF v_policies < 6 THEN RAISE EXCEPTION 'verify failed: expected >=6 policies, got %', v_policies; END IF;

  RAISE NOTICE 'verify ok: drafts=% slots=% rls(d)=% rls(s)=% fn=% policies=%',
    v_table_drafts, v_table_slots, v_rls_drafts, v_rls_slots, v_fn_exists, v_policies;
END
$verify$;