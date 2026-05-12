-- =========================================================
-- ETAPA 2 — HARDENING (3 fixes)
-- 1) Real shifts on publish (publish_schedule_draft)
-- 2) user_pins + verify_user_pin + set_user_pin
-- 3) Anon revokes (linter)
-- Protocolo C1: DO $verify$ aborta tudo se falhar.
-- =========================================================

-- 1) TABELA user_pins
CREATE TABLE IF NOT EXISTS public.user_pins (
  user_id uuid PRIMARY KEY,
  pin_hash text NOT NULL,
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  must_reset boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_user_pins_uat ON public.user_pins;
CREATE TRIGGER trg_user_pins_uat
  BEFORE UPDATE ON public.user_pins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;

-- RLS
DROP POLICY IF EXISTS "users see own pin" ON public.user_pins;
CREATE POLICY "users see own pin"
  ON public.user_pins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users update own pin" ON public.user_pins;
CREATE POLICY "users update own pin"
  ON public.user_pins FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users insert own pin" ON public.user_pins;
CREATE POLICY "users insert own pin"
  ON public.user_pins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admins manage all pins" ON public.user_pins;
CREATE POLICY "admins manage all pins"
  ON public.user_pins FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) set_user_pin (own user only)
CREATE OR REPLACE FUNCTION public.set_user_pin(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  v_clean := regexp_replace(COALESCE(p_pin, ''), '\D', '', 'g');
  IF length(v_clean) < 4 OR length(v_clean) > 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pin_length_invalid');
  END IF;

  INSERT INTO public.user_pins (user_id, pin_hash, must_reset, failed_attempts, locked_until)
  VALUES (v_uid, extensions.crypt(v_clean, extensions.gen_salt('bf', 8)), false, 0, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash,
        last_changed_at = now(),
        must_reset = false,
        failed_attempts = 0,
        locked_until = NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_pin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_pin(text) TO authenticated;

-- 3) verify_user_pin
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_row record;
  v_clean text;
BEGIN
  v_clean := regexp_replace(COALESCE(p_pin, ''), '\D', '', 'g');
  IF length(v_clean) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pin_too_short');
  END IF;

  SELECT * INTO v_row FROM public.user_pins WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pin_not_set');
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'locked', 'locked_until', v_row.locked_until);
  END IF;

  IF v_row.pin_hash = extensions.crypt(v_clean, v_row.pin_hash) THEN
    UPDATE public.user_pins
       SET failed_attempts = 0, locked_until = NULL
     WHERE user_id = p_user_id;
    RETURN jsonb_build_object('ok', true, 'must_reset', v_row.must_reset);
  ELSE
    UPDATE public.user_pins
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= 5
                               THEN now() + interval '15 minutes'
                               ELSE NULL END
     WHERE user_id = p_user_id;
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_pin',
                              'attempts', v_row.failed_attempts + 1);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_user_pin(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_pin(uuid, text) TO authenticated;

-- 4) seed PIN '0000' (must_reset) para operators e admins existentes
INSERT INTO public.user_pins (user_id, pin_hash, must_reset)
SELECT DISTINCT ur.user_id,
       extensions.crypt('0000', extensions.gen_salt('bf', 8)),
       true
FROM public.user_roles ur
WHERE ur.role IN ('admin'::app_role, 'operator'::app_role)
ON CONFLICT (user_id) DO NOTHING;

-- 5) validate_schedule_publish: trocar checagem besta por verify_user_pin
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
  v_total_unbound   int := 0;
  v_total_extras    int := 0;
  v_estimated_cost  numeric := 0;
  v_month_budget    numeric := 0;
  v_month_year      text;
  v_override_active boolean := false;
  v_pin_check       jsonb;
BEGIN
  SELECT * INTO v_draft FROM public.schedule_drafts WHERE id = p_draft_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'draft_not_found');
  END IF;
  IF v_draft.status <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'draft_not_in_draft_status', 'status', v_draft.status);
  END IF;

  -- Override: requer (a) auth.uid() com role operator E (b) verify_user_pin OK
  IF p_override_pin IS NOT NULL AND auth.uid() IS NOT NULL
     AND has_role(auth.uid(), 'operator'::app_role) THEN
    v_pin_check := public.verify_user_pin(auth.uid(), p_override_pin);
    IF (v_pin_check->>'ok')::boolean = true THEN
      v_override_active := true;
    END IF;
  END IF;

  v_month_year := to_char(v_draft.semana_inicio, 'YYYY-MM');
  SELECT COALESCE(freelancer_budget, 0) INTO v_month_budget
  FROM public.store_budgets
  WHERE store_id = v_draft.unit_id AND month_year = v_month_year
  LIMIT 1;

  FOR v_slot IN
    SELECT s.* FROM public.schedule_draft_slots s
    WHERE s.draft_id = p_draft_id ORDER BY s.schedule_date, s.start_time
  LOOP
    v_estimated_cost := v_estimated_cost + COALESCE(v_slot.agreed_rate, 0);
    IF v_slot.tipo = 'extra' THEN v_total_extras := v_total_extras + 1; END IF;

    IF v_slot.employee_id IS NULL THEN
      v_total_unbound := v_total_unbound + 1;
      v_blockers := v_blockers || jsonb_build_object(
        'slot_id', v_slot.id, 'date', v_slot.schedule_date,
        'reason', 'unbound',
        'message', format('Slot em %s (%s) sem funcionário vinculado.', v_slot.dia_semana, v_slot.shift_label)
      );
      CONTINUE;
    END IF;

    -- Interjornada 11h
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
        'slot_id', v_slot.id, 'date', v_slot.schedule_date,
        'reason', 'interjornada',
        'message', 'Art. 66 CLT — menos de 11h de descanso desde turno anterior.');
    END IF;

    -- Limite diário 10h
    IF (
      EXTRACT(EPOCH FROM (v_slot.end_time - v_slot.start_time))/3600.0
      + COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (sh.end_time - sh.start_time))/3600.0)
                  FROM public.schedules sch JOIN public.shifts sh ON sh.id = sch.shift_id
                  WHERE sch.employee_id = v_slot.employee_id
                    AND sch.schedule_date = v_slot.schedule_date
                    AND sch.status <> 'cancelled'), 0)
      + COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (s2.end_time - s2.start_time))/3600.0)
                  FROM public.schedule_draft_slots s2
                  WHERE s2.draft_id = p_draft_id
                    AND s2.employee_id = v_slot.employee_id
                    AND s2.schedule_date = v_slot.schedule_date
                    AND s2.id <> v_slot.id), 0)
    ) > 10 THEN
      v_blockers := v_blockers || jsonb_build_object(
        'slot_id', v_slot.id, 'date', v_slot.schedule_date,
        'reason', 'limite_diario',
        'message', 'Art. 59 CLT — total diário > 10h.');
    END IF;

    -- 44h semanal
    IF (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (s2.end_time - s2.start_time))/3600.0), 0)
        FROM public.schedule_draft_slots s2
        WHERE s2.draft_id = p_draft_id AND s2.employee_id = v_slot.employee_id) > 44 THEN
      v_blockers := v_blockers || jsonb_build_object(
        'slot_id', v_slot.id, 'date', v_slot.schedule_date,
        'reason', 'jornada_semanal',
        'message', 'Art. 58 CLT — jornada semanal > 44h.');
    END IF;

    -- DSR
    IF NOT EXISTS (
      SELECT 1 FROM generate_series(v_draft.semana_inicio, v_draft.semana_inicio + 6, interval '1 day') g(d)
      WHERE NOT EXISTS (SELECT 1 FROM public.schedule_draft_slots s3
                        WHERE s3.draft_id = p_draft_id
                          AND s3.employee_id = v_slot.employee_id
                          AND s3.schedule_date = g.d::date)
    ) THEN
      v_blockers := v_blockers || jsonb_build_object(
        'slot_id', v_slot.id, 'date', v_slot.schedule_date,
        'reason', 'dsr',
        'message', 'Art. 67 CLT — sem DSR.');
    END IF;

    -- Domingo feminino
    IF EXTRACT(DOW FROM v_slot.schedule_date) = 0 THEN
      IF EXISTS (SELECT 1 FROM public.employees e WHERE e.id = v_slot.employee_id AND e.gender = 'F')
        AND NOT EXISTS (
          SELECT 1 FROM generate_series(v_slot.schedule_date - interval '15 days',
                                        v_slot.schedule_date - interval '1 day',
                                        interval '1 day') g(d)
          WHERE EXTRACT(DOW FROM g.d) = 0
            AND NOT EXISTS (SELECT 1 FROM public.schedules sch
                            WHERE sch.employee_id = v_slot.employee_id
                              AND sch.schedule_date = g.d::date
                              AND sch.status <> 'cancelled')
        ) THEN
        v_blockers := v_blockers || jsonb_build_object(
          'slot_id', v_slot.id, 'date', v_slot.schedule_date,
          'reason', 'domingo_feminino',
          'message', 'Art. 386 CLT — funcionária sem folga dominical recente.');
      END IF;
    END IF;
  END LOOP;

  IF v_month_budget > 0 AND v_estimated_cost > v_month_budget AND NOT v_override_active THEN
    v_warnings := v_warnings || jsonb_build_object(
      'reason', 'budget_excedido',
      'message', format('Custo estimado R$%s excede orçamento mensal R$%s.', v_estimated_cost, v_month_budget),
      'estimated_cost', v_estimated_cost, 'month_budget', v_month_budget, 'overridable', true);
  END IF;

  IF v_total_extras > 0 AND NOT v_override_active THEN
    v_warnings := v_warnings || jsonb_build_object(
      'reason', 'extras_planejados',
      'message', format('%s slot(s) marcados como Extra — confirme cota mensal.', v_total_extras),
      'total_extras', v_total_extras, 'overridable', true);
  END IF;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_blockers) = 0,
    'can_publish', jsonb_array_length(v_blockers) = 0 AND v_total_unbound = 0,
    'blockers', v_blockers, 'warnings', v_warnings,
    'override_active', v_override_active,
    'estimated_cost', v_estimated_cost, 'month_budget', v_month_budget,
    'total_unbound', v_total_unbound, 'total_extras', v_total_extras
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_schedule_publish(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_schedule_publish(uuid, text) TO authenticated;

-- 6) Adicionar coluna de auditoria em shifts (rastreio de origem)
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS created_from_draft_id uuid REFERENCES public.schedule_drafts(id) ON DELETE SET NULL;

-- 7) publish_schedule_draft RPC — cria/reusa shifts e materializa schedules
CREATE OR REPLACE FUNCTION public.publish_schedule_draft(
  p_draft_id uuid,
  p_override_pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_draft       record;
  v_slot        record;
  v_validate    jsonb;
  v_shift_id    uuid;
  v_shift_type  text;
  v_inserted    int := 0;
BEGIN
  -- Validar primeiro
  v_validate := public.validate_schedule_publish(p_draft_id, p_override_pin);
  IF (v_validate->>'can_publish')::boolean IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_publish', 'detail', v_validate);
  END IF;

  SELECT * INTO v_draft FROM public.schedule_drafts WHERE id = p_draft_id;
  IF v_draft.status <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'draft_not_in_draft_status');
  END IF;

  FOR v_slot IN
    SELECT * FROM public.schedule_draft_slots
    WHERE draft_id = p_draft_id AND employee_id IS NOT NULL
    ORDER BY schedule_date, start_time
  LOOP
    v_shift_type := CASE v_slot.shift_type
                      WHEN 'jantar' THEN 'jantar'
                      WHEN 'dobra'  THEN 'dobra'
                      WHEN 'intermediario' THEN 'intermediario'
                      ELSE 'almoco'
                    END;

    -- Match exato (start_time, end_time, type) — shifts é global, não tem unit
    SELECT id INTO v_shift_id
    FROM public.shifts
    WHERE start_time = v_slot.start_time
      AND end_time = v_slot.end_time
      AND type = v_shift_type
    LIMIT 1;

    IF v_shift_id IS NULL THEN
      INSERT INTO public.shifts (name, start_time, end_time, type, created_from_draft_id)
      VALUES (
        format('%s-%s (%s)',
               to_char(v_slot.start_time, 'HH24:MI'),
               to_char(v_slot.end_time, 'HH24:MI'),
               v_shift_type),
        v_slot.start_time, v_slot.end_time, v_shift_type, p_draft_id
      )
      RETURNING id INTO v_shift_id;
    END IF;

    INSERT INTO public.schedules (
      employee_id, user_id, sector_id, shift_id, schedule_date,
      start_time, end_time, break_duration, schedule_type, status, agreed_rate
    ) VALUES (
      v_slot.employee_id, v_slot.employee_id,
      COALESCE(v_slot.sector_id, v_draft.sector_id),
      v_shift_id, v_slot.schedule_date,
      v_slot.start_time, v_slot.end_time, v_slot.break_min,
      'working'::schedule_type, 'scheduled', v_slot.agreed_rate
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  UPDATE public.schedule_drafts
     SET status = 'published',
         published_at = now(),
         published_by = auth.uid()
   WHERE id = p_draft_id;

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted, 'draft_id', p_draft_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_schedule_draft(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_schedule_draft(uuid, text) TO authenticated;

-- 8) DO $verify$ — protocolo C1 (8 invariantes)
DO $verify$
DECLARE
  v_user_pins    int;
  v_pin_seed     int;
  v_fn_set       int;
  v_fn_verify    int;
  v_fn_publish   int;
  v_col_audit    int;
  v_pol_pins     int;
  v_anon_funcs   int;
BEGIN
  -- (1) tabela user_pins
  SELECT COUNT(*) INTO v_user_pins
  FROM information_schema.tables
  WHERE table_schema='public' AND table_name='user_pins';
  IF v_user_pins <> 1 THEN RAISE EXCEPTION 'verify failed: user_pins missing'; END IF;

  -- (2) seed: ao menos 1 row em user_pins (devem existir admins)
  SELECT COUNT(*) INTO v_pin_seed FROM public.user_pins;
  IF v_pin_seed < 1 THEN
    RAISE WARNING 'verify warn: nenhum PIN seed (verifique se existem admin/operator)';
  END IF;

  -- (3) funções existem
  SELECT COUNT(*) INTO v_fn_set FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='set_user_pin';
  IF v_fn_set <> 1 THEN RAISE EXCEPTION 'verify failed: set_user_pin missing'; END IF;

  SELECT COUNT(*) INTO v_fn_verify FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='verify_user_pin';
  IF v_fn_verify <> 1 THEN RAISE EXCEPTION 'verify failed: verify_user_pin missing'; END IF;

  SELECT COUNT(*) INTO v_fn_publish FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='publish_schedule_draft';
  IF v_fn_publish <> 1 THEN RAISE EXCEPTION 'verify failed: publish_schedule_draft missing'; END IF;

  -- (4) coluna audit em shifts
  SELECT COUNT(*) INTO v_col_audit
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='shifts' AND column_name='created_from_draft_id';
  IF v_col_audit <> 1 THEN RAISE EXCEPTION 'verify failed: shifts.created_from_draft_id missing'; END IF;

  -- (5) policies user_pins
  SELECT COUNT(*) INTO v_pol_pins
  FROM pg_policies WHERE schemaname='public' AND tablename='user_pins';
  IF v_pol_pins < 4 THEN RAISE EXCEPTION 'verify failed: expected >=4 user_pins policies, got %', v_pol_pins; END IF;

  -- (6) anon NÃO pode executar nenhuma das 4 novas funções
  SELECT COUNT(*) INTO v_anon_funcs
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN ('set_user_pin','verify_user_pin','publish_schedule_draft','validate_schedule_publish')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_anon_funcs <> 0 THEN
    RAISE EXCEPTION 'verify failed: anon ainda tem EXECUTE em % funções novas', v_anon_funcs;
  END IF;

  -- (7) authenticated tem EXECUTE nas 4
  SELECT COUNT(*) INTO v_anon_funcs
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN ('set_user_pin','verify_user_pin','publish_schedule_draft','validate_schedule_publish')
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_anon_funcs <> 4 THEN
    RAISE EXCEPTION 'verify failed: authenticated deveria ter EXECUTE nas 4 (tem %)', v_anon_funcs;
  END IF;

  -- (8) RLS ativo em user_pins
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.user_pins'::regclass) THEN
    RAISE EXCEPTION 'verify failed: RLS off em user_pins';
  END IF;

  RAISE NOTICE 'verify ok: pins=% seed=% fns(set/verify/publish)=%/%/% audit=% policies=% anon_exec=0',
    v_user_pins, v_pin_seed, v_fn_set, v_fn_verify, v_fn_publish, v_col_audit, v_pol_pins;
END
$verify$;