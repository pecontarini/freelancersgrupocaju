ALTER TABLE public.freelancer_profiles 
  ADD COLUMN IF NOT EXISTS tipo_chave_pix text,
  ADD COLUMN IF NOT EXISTS chave_pix text;