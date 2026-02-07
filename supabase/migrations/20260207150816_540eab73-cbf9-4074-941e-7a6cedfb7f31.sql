-- Add new columns for detailed failure information
ALTER TABLE public.supervision_failures
ADD COLUMN IF NOT EXISTS detalhes_falha text,
ADD COLUMN IF NOT EXISTS url_foto_evidencia text;

-- Add comment for documentation
COMMENT ON COLUMN public.supervision_failures.detalhes_falha IS 'Comentário do item da auditoria explicando o problema';
COMMENT ON COLUMN public.supervision_failures.url_foto_evidencia IS 'URL da foto de evidência do problema identificado';