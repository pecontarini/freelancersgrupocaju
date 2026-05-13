BEGIN;

ALTER TABLE public.config_lojas
  ADD COLUMN IF NOT EXISTS cnpj text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_config_lojas_cnpj
  ON public.config_lojas (cnpj) WHERE cnpj IS NOT NULL;

UPDATE public.config_lojas SET cnpj='35.631.524/0002-46' WHERE code='NZ GO';
UPDATE public.config_lojas SET cnpj='35.631.524/0003-27' WHERE code='CP SG';
UPDATE public.config_lojas SET cnpj='35.631.524/0005-99' WHERE code='CP AN';
UPDATE public.config_lojas SET cnpj='35.631.524/0012-18' WHERE code='CP AC';
UPDATE public.config_lojas SET cnpj='35.631.524/0014-80' WHERE code='CP AS';
UPDATE public.config_lojas SET cnpj='21.131.221/0001-79' WHERE code='NZ AS';
UPDATE public.config_lojas SET cnpj='21.131.221/0003-30' WHERE code='NZ AC';
UPDATE public.config_lojas SET cnpj='21.131.221/0004-11' WHERE code='NZ SG';
UPDATE public.config_lojas SET cnpj='37.119.545/0001-21' WHERE code='CJ AN';
UPDATE public.config_lojas SET cnpj='37.119.545/0003-93' WHERE code='CJ SG';
UPDATE public.config_lojas SET cnpj='62.723.936/0001-06' WHERE code='CJ SP';

CREATE TABLE public.cnpj_administrativo (
  id bigserial PRIMARY KEY,
  cnpj text UNIQUE NOT NULL,
  razao_social text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('matriz_admin','servicos','holding')),
  holding_principal text NOT NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cnpj_administrativo ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_cnpj_admin_all ON public.cnpj_administrativo
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY p_cnpj_admin_read ON public.cnpj_administrativo
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'operator')
    OR has_role(auth.uid(),'gerente_unidade')
  );

INSERT INTO public.cnpj_administrativo (cnpj, razao_social, tipo, holding_principal, notas) VALUES
  ('35.631.524/0001-65', 'MULT 01 - CPD - Matriz',          'matriz_admin', '35.631.524', 'Matriz admin grupo Caminito + Nazo GO'),
  ('35.631.524/0007-50', 'MULT 07 - FERMULT SERVIÇOS',      'servicos',     '35.631.524', 'PJ de serviços do grupo'),
  ('21.131.221/0005-00', 'NFE 05 - CPD',                    'matriz_admin', '21.131.221', 'CPD do grupo Nazo'),
  ('37.119.545/0004-74', 'CAJU HOLDING - CAJUPAR SERVIÇOS', 'holding',      '37.119.545', 'Holding administrativa Caju (ASN+SIG)');

CREATE TABLE public.payout_orphan_records (
  id bigserial PRIMARY KEY,
  source_meta_key text NOT NULL,
  raw_loja_identifier text NOT NULL,
  raw_payload jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_orphan_unresolved
  ON public.payout_orphan_records (source_meta_key, detected_at DESC)
  WHERE resolved = false;

ALTER TABLE public.payout_orphan_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_orphan_admin ON public.payout_orphan_records
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

DO $verify$
DECLARE
  v_lojas_cnpj int;
  v_admin int;
  v_orphan_exists boolean;
BEGIN
  SELECT COUNT(*) INTO v_lojas_cnpj
    FROM public.config_lojas
   WHERE cnpj IS NOT NULL AND is_active=true;
  SELECT COUNT(*) INTO v_admin FROM public.cnpj_administrativo;
  SELECT EXISTS (SELECT 1 FROM pg_tables
                  WHERE tablename='payout_orphan_records')
    INTO v_orphan_exists;

  IF v_lojas_cnpj <> 11 THEN
    RAISE EXCEPTION 'CNPJ backfill: esperado 11, encontrado %', v_lojas_cnpj;
  END IF;
  IF v_admin <> 4 THEN
    RAISE EXCEPTION 'cnpj_administrativo: esperado 4, encontrado %', v_admin;
  END IF;
  IF NOT v_orphan_exists THEN
    RAISE EXCEPTION 'payout_orphan_records nao criada';
  END IF;
  RAISE NOTICE 'Migration 2 OK: 11/11 lojas com CNPJ, 4 admin, orphan pronto';
END
$verify$;

COMMIT;