
CREATE OR REPLACE FUNCTION public.cleanup_units_schedule_data(p_unit_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_schedules int;
  v_attendance int;
  v_free_entries int;
  v_free_checkins int;
  v_matrix int;
  v_partnerships int;
  v_sjt int;
  v_employees int;
  v_jobs int;
  v_sectors int;
BEGIN
  IF v_uid IS NOT NULL AND NOT has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente admin pode executar limpeza.';
  END IF;

  DELETE FROM schedule_attendance WHERE schedule_id IN (
    SELECT s.id FROM schedules s
    JOIN employees e ON e.id = s.employee_id
    WHERE e.unit_id = ANY(p_unit_ids)
  );
  GET DIAGNOSTICS v_attendance = ROW_COUNT;

  DELETE FROM schedules WHERE employee_id IN (SELECT id FROM employees WHERE unit_id = ANY(p_unit_ids));
  GET DIAGNOSTICS v_schedules = ROW_COUNT;

  DELETE FROM freelancer_entries WHERE loja_id = ANY(p_unit_ids);
  GET DIAGNOSTICS v_free_entries = ROW_COUNT;

  DELETE FROM freelancer_checkins WHERE loja_id = ANY(p_unit_ids);
  GET DIAGNOSTICS v_free_checkins = ROW_COUNT;

  DELETE FROM staffing_matrix WHERE sector_id IN (SELECT id FROM sectors WHERE unit_id = ANY(p_unit_ids));
  GET DIAGNOSTICS v_matrix = ROW_COUNT;

  DELETE FROM sector_partnerships
  WHERE sector_id IN (SELECT id FROM sectors WHERE unit_id = ANY(p_unit_ids))
     OR partner_sector_id IN (SELECT id FROM sectors WHERE unit_id = ANY(p_unit_ids));
  GET DIAGNOSTICS v_partnerships = ROW_COUNT;

  DELETE FROM sector_job_titles WHERE sector_id IN (SELECT id FROM sectors WHERE unit_id = ANY(p_unit_ids));
  GET DIAGNOSTICS v_sjt = ROW_COUNT;

  DELETE FROM employees WHERE unit_id = ANY(p_unit_ids);
  GET DIAGNOSTICS v_employees = ROW_COUNT;

  DELETE FROM job_titles WHERE unit_id = ANY(p_unit_ids);
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  DELETE FROM sectors WHERE unit_id = ANY(p_unit_ids);
  GET DIAGNOSTICS v_sectors = ROW_COUNT;

  RETURN jsonb_build_object(
    'schedule_attendance_deleted', v_attendance,
    'schedules_deleted', v_schedules,
    'freelancer_entries_deleted', v_free_entries,
    'freelancer_checkins_deleted', v_free_checkins,
    'staffing_matrix_deleted', v_matrix,
    'sector_partnerships_deleted', v_partnerships,
    'sector_job_titles_deleted', v_sjt,
    'employees_deleted', v_employees,
    'job_titles_deleted', v_jobs,
    'sectors_deleted', v_sectors
  );
END;
$$;
