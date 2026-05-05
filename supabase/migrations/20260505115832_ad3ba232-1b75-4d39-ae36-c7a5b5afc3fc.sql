ALTER TABLE public.sheets_sources ADD COLUMN IF NOT EXISTS meta_key text;
CREATE UNIQUE INDEX IF NOT EXISTS sheets_sources_meta_key_active_unique
  ON public.sheets_sources(meta_key)
  WHERE meta_key IS NOT NULL AND ativo = true;