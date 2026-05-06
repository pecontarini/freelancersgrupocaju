
ALTER TABLE public.turno_config
  ADD COLUMN IF NOT EXISTS modelo_folga TEXT CHECK (modelo_folga IN ('5x2','6x1')),
  ADD COLUMN IF NOT EXISTS qtd_abridores INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qtd_fechadores INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qtd_intermediarios INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE public.turno_config ALTER COLUMN entrada_1 DROP NOT NULL;
ALTER TABLE public.turno_config ALTER COLUMN saida_1 DROP NOT NULL;
ALTER TABLE public.turno_config ALTER COLUMN tipo_turno DROP NOT NULL;
ALTER TABLE public.turno_config ALTER COLUMN dia_tipo DROP NOT NULL;

ALTER TABLE public.turno_config DROP CONSTRAINT IF EXISTS turno_config_unidade_id_setor_tipo_turno_dia_tipo_key;
ALTER TABLE public.turno_config ADD CONSTRAINT turno_config_unidade_setor_uniq UNIQUE (unidade_id, setor);
