
CREATE OR REPLACE FUNCTION public.merge_employees_into_secullum(
  p_unit_id uuid,
  p_pairs jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair jsonb;
  v_keep uuid;
  v_merge uuid;
  v_merge_ids jsonb;
  v_schedules_moved int := 0;
  v_schedules_cancelled int := 0;
  v_entries_moved int := 0;
  v_checkins_moved int := 0;
  v_employees_deleted int := 0;
  v_tmp int := 0;
  v_conflict_id uuid;
  v_sched record;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'operator'::app_role)
    OR public.has_role(auth.uid(), 'gerente_unidade'::app_role)
  ) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  FOR v_pair IN SELECT * FROM jsonb_array_elements(p_pairs)
  LOOP
    v_keep := (v_pair->>'keep_id')::uuid;
    v_merge_ids := v_pair->'merge_ids';

    PERFORM 1 FROM public.employees
      WHERE id = v_keep AND unit_id = p_unit_id AND secullum_id IS NOT NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cadastro canônico inválido ou sem secullum_id: %', v_keep;
    END IF;

    FOR v_merge IN SELECT (jsonb_array_elements_text(v_merge_ids))::uuid
    LOOP
      PERFORM 1 FROM public.employees
        WHERE id = v_merge AND unit_id = p_unit_id;
      IF NOT FOUND OR v_merge = v_keep THEN
        CONTINUE;
      END IF;

      FOR v_sched IN
        SELECT id, schedule_date, sector_id FROM public.schedules
        WHERE employee_id = v_merge AND status <> 'cancelled'
      LOOP
        SELECT id INTO v_conflict_id FROM public.schedules
          WHERE employee_id = v_keep
            AND schedule_date = v_sched.schedule_date
            AND sector_id = v_sched.sector_id
            AND status <> 'cancelled'
          LIMIT 1;
        IF v_conflict_id IS NOT NULL THEN
          UPDATE public.schedules SET status = 'cancelled', updated_at = now()
            WHERE id = v_sched.id;
          v_schedules_cancelled := v_schedules_cancelled + 1;
        ELSE
          UPDATE public.schedules
            SET employee_id = v_keep, user_id = v_keep, updated_at = now()
            WHERE id = v_sched.id;
          v_schedules_moved := v_schedules_moved + 1;
        END IF;
      END LOOP;

      UPDATE public.schedules
        SET employee_id = v_keep, user_id = v_keep
        WHERE employee_id = v_merge AND status = 'cancelled';

      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='freelancer_entries' AND column_name='employee_id') THEN
        UPDATE public.freelancer_entries SET employee_id = v_keep WHERE employee_id = v_merge;
        GET DIAGNOSTICS v_tmp = ROW_COUNT;
        v_entries_moved := v_entries_moved + v_tmp;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='freelancer_checkins' AND column_name='employee_id') THEN
        UPDATE public.freelancer_checkins SET employee_id = v_keep WHERE employee_id = v_merge;
        GET DIAGNOSTICS v_tmp = ROW_COUNT;
        v_checkins_moved := v_checkins_moved + v_tmp;
      END IF;

      DELETE FROM public.employees WHERE id = v_merge;
      v_employees_deleted := v_employees_deleted + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'schedules_moved', v_schedules_moved,
    'schedules_cancelled', v_schedules_cancelled,
    'entries_moved', v_entries_moved,
    'checkins_moved', v_checkins_moved,
    'employees_deleted', v_employees_deleted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_employees_into_secullum(uuid, jsonb) TO authenticated;
