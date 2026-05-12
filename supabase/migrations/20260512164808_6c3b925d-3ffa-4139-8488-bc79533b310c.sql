BEGIN;

ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS inativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inativo_marcado_em timestamptz,
  ADD COLUMN IF NOT EXISTS inativo_marcado_por uuid;

CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_ativos
  ON public.freelancer_profiles (id)
  WHERE inativo = false;

DO $verify$
DECLARE
  v_inativo_count int;
  v_em_count int;
  v_por_count int;
  v_idx_count int;
  v_default_check boolean;
BEGIN
  SELECT count(*) INTO v_inativo_count
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='freelancer_profiles' AND column_name='inativo';

  SELECT count(*) INTO v_em_count
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='freelancer_profiles' AND column_name='inativo_marcado_em';

  SELECT count(*) INTO v_por_count
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='freelancer_profiles' AND column_name='inativo_marcado_por';

  IF v_inativo_count <> 1 OR v_em_count <> 1 OR v_por_count <> 1 THEN
    RAISE EXCEPTION 'verify failed: missing columns (inativo=%, em=%, por=%)', v_inativo_count, v_em_count, v_por_count;
  END IF;

  SELECT count(*) INTO v_idx_count
  FROM pg_indexes
  WHERE schemaname='public' AND tablename='freelancer_profiles' AND indexname='idx_freelancer_profiles_ativos';

  IF v_idx_count <> 1 THEN
    RAISE EXCEPTION 'verify failed: index idx_freelancer_profiles_ativos missing';
  END IF;

  -- Confirm all existing rows defaulted to inativo=false (nobody marked inactive by accident)
  IF EXISTS (SELECT 1 FROM public.freelancer_profiles WHERE inativo IS NULL OR inativo = true) THEN
    RAISE EXCEPTION 'verify failed: unexpected non-false inativo values after backfill';
  END IF;

  RAISE NOTICE 'verify OK: all 3 columns + index created, all rows default to ativo';
END;
$verify$;

COMMIT;