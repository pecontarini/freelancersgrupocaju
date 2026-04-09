-- Prevent duplicate active schedules for the same employee+date+sector
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_schedule
ON public.schedules (employee_id, schedule_date, sector_id)
WHERE status <> 'cancelled';

-- Prevent duplicate freelancer employees by CPF within a unit
CREATE UNIQUE INDEX IF NOT EXISTS unique_freelancer_cpf_unit
ON public.employees (cpf, unit_id)
WHERE worker_type = 'freelancer' AND cpf IS NOT NULL AND active = true;