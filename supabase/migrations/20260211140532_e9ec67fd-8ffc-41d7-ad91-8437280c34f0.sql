
-- 1. Create enums
CREATE TYPE public.worker_type AS ENUM ('clt', 'freelancer');
CREATE TYPE public.schedule_type AS ENUM ('working', 'off', 'vacation', 'sick_leave');

-- 2. Add columns to employees
ALTER TABLE public.employees
  ADD COLUMN worker_type public.worker_type NOT NULL DEFAULT 'clt',
  ADD COLUMN default_rate numeric DEFAULT 0;

-- 3. Add columns to schedules
ALTER TABLE public.schedules
  ADD COLUMN start_time time WITHOUT TIME ZONE,
  ADD COLUMN end_time time WITHOUT TIME ZONE,
  ADD COLUMN break_duration integer NOT NULL DEFAULT 60,
  ADD COLUMN schedule_type public.schedule_type NOT NULL DEFAULT 'working',
  ADD COLUMN agreed_rate numeric DEFAULT 0;

-- 4. Create daily_budgets table
CREATE TABLE public.daily_budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.config_lojas(id),
  budget_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(date, unit_id)
);

ALTER TABLE public.daily_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View daily_budgets based on role" ON public.daily_budgets
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR user_has_access_to_loja(auth.uid(), unit_id)
  );

CREATE POLICY "Manage daily_budgets based on role" ON public.daily_budgets
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR user_has_access_to_loja(auth.uid(), unit_id)
  ) WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR user_has_access_to_loja(auth.uid(), unit_id)
  );

-- 5. Update trigger for daily_budgets
CREATE TRIGGER update_daily_budgets_updated_at
  BEFORE UPDATE ON public.daily_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
