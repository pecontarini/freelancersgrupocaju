
-- Add phone and job_title to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT;
