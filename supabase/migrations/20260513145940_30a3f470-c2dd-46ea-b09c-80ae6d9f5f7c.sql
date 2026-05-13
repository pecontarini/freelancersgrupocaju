BEGIN;

UPDATE public.payout_indicator_sources
   SET source_meta_key = 'cmv-salmao',
       notes = 'kg salmão por R$1k vendido (média mensal — fonte cmv-salmao)'
 WHERE indicador = 'CMV NAZO'
   AND cargo = 'Gerente Back'
   AND brand_filter = 'Nazo';

CREATE OR REPLACE FUNCTION public.normalize_loja_code(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT NULLIF(REPLACE(TRIM(p_raw), '_', ' '), '')
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_loja_code(text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.normalize_loja_code(text)
  TO authenticated;

DO $verify$
DECLARE v_mapping int;
BEGIN
  SELECT COUNT(*) INTO v_mapping
    FROM public.payout_indicator_sources
   WHERE indicador = 'CMV NAZO' AND source_meta_key = 'cmv-salmao';
  IF v_mapping <> 1 THEN
    RAISE EXCEPTION 'Mapping CMV NAZO inconsistente: %', v_mapping;
  END IF;
  IF public.normalize_loja_code('NZ_GO') <> 'NZ GO' THEN
    RAISE EXCEPTION 'normalize_loja_code: NZ_GO não virou NZ GO';
  END IF;
  IF public.normalize_loja_code('  CP AN  ') <> 'CP AN' THEN
    RAISE EXCEPTION 'normalize_loja_code: trim falhou';
  END IF;
  IF public.normalize_loja_code('') IS NOT NULL THEN
    RAISE EXCEPTION 'normalize_loja_code: vazio deveria virar NULL';
  END IF;
  RAISE NOTICE 'Migration 1 OK: CMV NAZO->cmv-salmao + normalize_loja_code (3 testes)';
END
$verify$;

COMMIT;