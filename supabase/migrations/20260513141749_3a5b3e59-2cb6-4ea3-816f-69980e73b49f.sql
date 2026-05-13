BEGIN;

ALTER TABLE public.config_lojas
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.config_lojas SET code='CP AN', brand='Caminito' WHERE nome ILIKE '%CAMINITO ASA NORTE%';
UPDATE public.config_lojas SET code='CP AS', brand='Caminito' WHERE nome ILIKE '%CAMINITO ASA SUL%';
UPDATE public.config_lojas SET code='CP SG', brand='Caminito' WHERE nome ILIKE '%CAMINITO SIG%';
UPDATE public.config_lojas SET code='CP AC', brand='Caminito' WHERE nome ILIKE '%CAMINITO AGUAS CLARAS%';
UPDATE public.config_lojas SET code='NZ AS', brand='Nazo'     WHERE nome ILIKE '%NAZO ASA SUL%';
UPDATE public.config_lojas SET code='NZ AC', brand='Nazo'     WHERE nome ILIKE '%NAZO AGUAS CLARAS%';
UPDATE public.config_lojas SET code='NZ SG', brand='Nazo'     WHERE nome ILIKE '%NAZO SIG%';
UPDATE public.config_lojas SET code='NZ GO', brand='Nazo'     WHERE nome ILIKE '%NAZO GO%';
UPDATE public.config_lojas SET code='CJ AN', brand='Caju'     WHERE nome ILIKE 'CAJU 01%ASA NORTE%';
UPDATE public.config_lojas SET code='CJ SG', brand='Caju'     WHERE nome ILIKE 'CAJU 03%SIG%';
UPDATE public.config_lojas SET code='CJ SP', brand='Caju'     WHERE nome ILIKE '%CAJU%ITAIM%';

UPDATE public.config_lojas SET is_active=false WHERE nome ILIKE '%CPD%GRUPO%CAJU%';
UPDATE public.config_lojas SET is_active=false WHERE nome ILIKE 'FB0%';
UPDATE public.config_lojas SET is_active=false WHERE nome ILIKE '%RESPONSA%';
UPDATE public.config_lojas SET is_active=false WHERE code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_config_lojas_code
  ON public.config_lojas (code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_config_lojas_brand
  ON public.config_lojas (brand) WHERE brand IS NOT NULL;

DO $verify$
DECLARE
  v_with_code int; v_caminito int; v_nazo int; v_caju int; v_active int;
BEGIN
  SELECT COUNT(*) INTO v_with_code FROM public.config_lojas WHERE code IS NOT NULL;
  SELECT COUNT(*) INTO v_caminito  FROM public.config_lojas WHERE brand='Caminito';
  SELECT COUNT(*) INTO v_nazo      FROM public.config_lojas WHERE brand='Nazo';
  SELECT COUNT(*) INTO v_caju      FROM public.config_lojas WHERE brand='Caju';
  SELECT COUNT(*) INTO v_active    FROM public.config_lojas WHERE is_active=true;
  IF v_with_code <> 11 THEN RAISE EXCEPTION 'A0 falhou: esperado 11 lojas com code, encontrado %', v_with_code; END IF;
  IF v_caminito <> 4 THEN RAISE EXCEPTION 'A0 falhou: esperado 4 Caminito, encontrado %', v_caminito; END IF;
  IF v_nazo <> 4 THEN RAISE EXCEPTION 'A0 falhou: esperado 4 Nazo, encontrado %', v_nazo; END IF;
  IF v_caju <> 3 THEN RAISE EXCEPTION 'A0 falhou: esperado 3 Caju, encontrado %', v_caju; END IF;
  IF v_active <> 11 THEN RAISE EXCEPTION 'A0 falhou: esperado 11 ativas, encontrado %', v_active; END IF;
  RAISE NOTICE 'A0 OK: 11 lojas ativas (4 Caminito + 4 Nazo + 3 Caju)';
END
$verify$;

COMMIT;