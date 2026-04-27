-- Substituir índice rígido (unit + nome) por (unit + nome + cargo)
-- Isso permite cadastrar funcionários com mesmo primeiro nome desde que tenham cargos diferentes
DROP INDEX IF EXISTS public.unique_active_employee_no_cpf;

CREATE UNIQUE INDEX unique_active_employee_no_cpf
ON public.employees (
  unit_id,
  lower(trim(name)),
  lower(coalesce(trim(job_title), ''))
)
WHERE active = true AND (cpf IS NULL OR cpf = '');