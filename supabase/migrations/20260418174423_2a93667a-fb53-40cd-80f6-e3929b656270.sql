
-- Função temporária para zerar dados de escala de duas lojas específicas
CREATE OR REPLACE FUNCTION public.cleanup_units_schedule_data(p_unit_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedules int;
  v_manual int;
  v_scheduled_free int;
  v_free_entries int;
  v_matrix int;
  v_partnerships int;
  v_sjt int;
  v_employees int;
  v_jobs int;
  v_sectors int;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente admin pode executar limpeza.';
  END IF;

  DELETE FROM schedules WHERE employee_id IN (SELECT id FROM employees WHERE unit_id = ANY(p_unit_ids));
  GET DIAGNOSTICS v_schedules = ROW_COUNT;

  DELETE FROM manual_schedules WHERE unit_id = ANY(p_unit_ids);
  GET DIAGNOSTICS v_manual = ROW_COUNT;

  DELETE FROM scheduled_freelancers WHERE unit_id = ANY(p_unit_ids);
  GET DIAGNOSTICS v_scheduled_free = ROW_COUNT;

  DELETE FROM freelancer_entries WHERE unit_id = ANY(p_unit_ids);
  GET DIAGNOSTICS v_free_entries = ROW_COUNT;

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
    'schedules_deleted', v_schedules,
    'manual_schedules_deleted', v_manual,
    'scheduled_freelancers_deleted', v_scheduled_free,
    'freelancer_entries_deleted', v_free_entries,
    'staffing_matrix_deleted', v_matrix,
    'sector_partnerships_deleted', v_partnerships,
    'sector_job_titles_deleted', v_sjt,
    'employees_deleted', v_employees,
    'job_titles_deleted', v_jobs,
    'sectors_deleted', v_sectors
  );
END;
$$;
