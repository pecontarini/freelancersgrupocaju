ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS default_start_time time without time zone,
  ADD COLUMN IF NOT EXISTS default_end_time time without time zone;

COMMENT ON COLUMN public.employees.default_start_time IS 'Horário de entrada de referência (cadastro de ativos)';
COMMENT ON COLUMN public.employees.default_end_time IS 'Horário de saída de referência (cadastro de ativos); pode virar o dia';