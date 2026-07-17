ALTER TABLE public.freelancer_entries 
  ADD COLUMN IF NOT EXISTS substitui text,
  ADD COLUMN IF NOT EXISTS motivo text;

ALTER TABLE public.freelancer_entries ALTER COLUMN funcao DROP NOT NULL;