ALTER TABLE public.employees ADD COLUMN cpf text;
CREATE INDEX idx_employees_cpf ON public.employees(cpf);