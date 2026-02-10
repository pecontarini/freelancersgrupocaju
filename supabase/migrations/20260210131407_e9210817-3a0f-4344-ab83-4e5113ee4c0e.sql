
-- Employees table for staffing
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  name text NOT NULL,
  gender text NOT NULL DEFAULT 'M' CHECK (gender IN ('M', 'F')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employees" ON public.employees
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage employees" ON public.employees
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Gerentes can manage employees of their units" ON public.employees
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_stores WHERE user_id = auth.uid() AND loja_id = employees.unit_id)
  );

-- Update schedules to reference employees instead of auth users
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_user_id_fkey;
-- user_id now references employees
-- Add employee_id column pointing to employees table
ALTER TABLE public.schedules ADD COLUMN employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE;

-- CLT validation function
CREATE OR REPLACE FUNCTION public.validate_schedule_clt(
  p_employee_id uuid,
  p_schedule_date date,
  p_shift_id uuid,
  p_sector_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift record;
  v_employee record;
  v_prev_schedule record;
  v_prev_shift record;
  v_same_day_schedules record;
  v_same_day_hours numeric;
  v_interval_hours numeric;
  v_last_sunday_off date;
  v_result jsonb := '{"valid": true, "errors": []}'::jsonb;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- Get shift info
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'errors', jsonb_build_array('Turno não encontrado.'));
  END IF;

  -- Get employee info
  SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'errors', jsonb_build_array('Funcionário não encontrado.'));
  END IF;

  -- 1. Interjornada: 11h rest since last shift end
  SELECT s.*, sh.end_time, sh.start_time as sh_start
  INTO v_prev_schedule
  FROM schedules s
  JOIN shifts sh ON sh.id = s.shift_id
  WHERE s.employee_id = p_employee_id
    AND s.schedule_date <= p_schedule_date
    AND (s.schedule_date < p_schedule_date OR sh.start_time < v_shift.start_time)
    AND s.status != 'cancelled'
  ORDER BY s.schedule_date DESC, sh.end_time DESC
  LIMIT 1;

  IF v_prev_schedule IS NOT NULL THEN
    -- Calculate hours between previous shift end and new shift start
    v_interval_hours := EXTRACT(EPOCH FROM (
      (p_schedule_date + v_shift.start_time::time) - 
      (v_prev_schedule.schedule_date + v_prev_schedule.end_time::time)
    )) / 3600.0;
    
    IF v_interval_hours < 11 THEN
      v_errors := v_errors || jsonb_build_array(
        format('Art. 66 CLT - Interjornada: Apenas %.1fh de descanso (mínimo 11h).', v_interval_hours)
      );
    END IF;
  END IF;

  -- 2. Domingo feminino: at least 1 Sunday off in last 15 days
  IF v_employee.gender = 'F' THEN
    -- Check if there's at least one Sunday without schedule in last 15 days
    PERFORM 1
    FROM generate_series(p_schedule_date - interval '15 days', p_schedule_date, interval '1 day') d
    WHERE EXTRACT(DOW FROM d) = 0
      AND NOT EXISTS (
        SELECT 1 FROM schedules sc
        WHERE sc.employee_id = p_employee_id
          AND sc.schedule_date = d::date
          AND sc.status != 'cancelled'
      );
    
    IF NOT FOUND AND EXTRACT(DOW FROM p_schedule_date) = 0 THEN
      v_errors := v_errors || jsonb_build_array(
        'Art. 386 CLT - Funcionária sem folga dominical nos últimos 15 dias.'
      );
    END IF;
  END IF;

  -- 3. Limite diário: max 10h per day
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (sh.end_time::time - sh.start_time::time)) / 3600.0
  ), 0) as total_hours
  INTO v_same_day_schedules
  FROM schedules s
  JOIN shifts sh ON sh.id = s.shift_id
  WHERE s.employee_id = p_employee_id
    AND s.schedule_date = p_schedule_date
    AND s.status != 'cancelled';

  v_same_day_hours := COALESCE(v_same_day_schedules.total_hours, 0) +
    EXTRACT(EPOCH FROM (v_shift.end_time::time - v_shift.start_time::time)) / 3600.0;

  IF v_same_day_hours > 10 THEN
    v_errors := v_errors || jsonb_build_array(
      format('Art. 59 CLT - Limite diário: %.1fh programadas (máximo 10h).', v_same_day_hours)
    );
  END IF;

  -- 4. Dobra: if 2 shifts same day, gap max 4h
  IF v_same_day_schedules.total_hours > 0 THEN
    -- Check gap between existing shift and new shift
    SELECT sh.end_time::time as prev_end, sh.start_time::time as prev_start
    INTO v_prev_shift
    FROM schedules s
    JOIN shifts sh ON sh.id = s.shift_id
    WHERE s.employee_id = p_employee_id
      AND s.schedule_date = p_schedule_date
      AND s.status != 'cancelled'
    ORDER BY sh.end_time DESC
    LIMIT 1;

    IF v_prev_shift IS NOT NULL THEN
      v_interval_hours := ABS(EXTRACT(EPOCH FROM (v_shift.start_time::time - v_prev_shift.prev_end)) / 3600.0);
      IF v_interval_hours > 4 THEN
        v_errors := v_errors || jsonb_build_array(
          format('Dobra irregular: %.1fh de intervalo entre turnos (máximo 4h).', v_interval_hours)
        );
      END IF;
    END IF;
  END IF;

  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN jsonb_build_object('valid', false, 'errors', v_errors);
  END IF;

  RETURN jsonb_build_object('valid', true, 'errors', '[]'::jsonb);
END;
$$;
