BEGIN;

CREATE TABLE public.payout_rules (
  id bigserial PRIMARY KEY,
  cargo text NOT NULL,
  indicador text NOT NULL,
  breakpoint numeric NOT NULL,
  descricao text NOT NULL,
  payout_brl numeric(10,2) NOT NULL,
  direcao text NOT NULL CHECK (direcao IN ('HIGH','LOW')),
  is_active boolean NOT NULL DEFAULT true,
  valid_from date NOT NULL DEFAULT date_trunc('month', current_date)::date,
  valid_to date,
  source text NOT NULL DEFAULT 'sheets:payout_rules',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cargo, indicador, breakpoint, valid_from)
);
CREATE INDEX idx_payout_rules_lookup ON public.payout_rules (cargo, indicador, is_active) WHERE is_active = true;
ALTER TABLE public.payout_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_payout_rules_admin ON public.payout_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY p_payout_rules_read_all_roles ON public.payout_rules FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operator') OR has_role(auth.uid(),'gerente_unidade'));

CREATE TABLE public.payout_indicator_sources (
  id bigserial PRIMARY KEY,
  indicador text NOT NULL,
  cargo text,
  brand_filter text,
  source_meta_key text NOT NULL,
  parser_fn text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_payout_indicator_sources
  ON public.payout_indicator_sources (indicador, COALESCE(cargo,'__all__'), COALESCE(brand_filter,'__all__'));
ALTER TABLE public.payout_indicator_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_sources_admin ON public.payout_indicator_sources FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO public.payout_indicator_sources (indicador, cargo, brand_filter, source_meta_key, parser_fn, notes) VALUES
  ('NPS Salão',      NULL, NULL, 'atendimento-medias', 'parse_nps_revenue',   'R$ por avaliação 1-3 do salão'),
  ('NPS Delivery',   NULL, NULL, 'atendimento-medias', 'parse_nps_revenue',   'R$ por avaliação 1-3 do delivery'),
  ('Tempo de Prato', NULL, NULL, 'kds-salao',          'parse_kds_brand_avg', 'Tempo médio salão por marca'),
  ('Tempo Delivery', 'Chefe de APV', NULL, 'kds-delivery', 'parse_kds_brand_avg', 'Tempo médio delivery'),
  ('Conformidade',   NULL, NULL, 'conformidade',       'parse_conformidade',  'Média checklist por unidade'),
  ('CMV CAMINITO',   'Gerente Back', 'Caminito', 'cmv-carnes',   'parse_cmv_carnes_diff', 'Diferença % sobre transferido'),
  ('CMV NAZO',       'Gerente Back', 'Nazo',     'salmao_diario','parse_cmv_salmao_avg',  'kg salmão por R$1k vendido'),
  ('Budget',         'Gerente Front', NULL, '__pending_budget__',  'parse_budget_economy',  'Fonte ainda não vinculada'),
  ('CMV',            NULL, NULL,             '__pending_cmv_cpd__', 'parse_cmv_global',      'Fonte ainda não vinculada');

CREATE TABLE public.payout_results_monthly (
  id bigserial PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id),
  cargo text NOT NULL,
  indicador text NOT NULL,
  mes_ref date NOT NULL,
  resultado_valor numeric,
  breakpoint_atingido numeric,
  breakpoint_descricao text,
  payout_brl numeric(10,2) NOT NULL DEFAULT 0,
  source_origin text NOT NULL CHECK (source_origin IN ('manual_planilha','auto_rpc','override')),
  source_meta_key text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  computed_by text NOT NULL DEFAULT 'n8n',
  run_id text,
  override_user_id uuid REFERENCES auth.users(id),
  override_reason text,
  UNIQUE (loja_id, cargo, indicador, mes_ref)
);
CREATE INDEX idx_payout_results_lookup ON public.payout_results_monthly (mes_ref DESC, loja_id, cargo);
ALTER TABLE public.payout_results_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_results_admin ON public.payout_results_monthly FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE POLICY p_results_operator ON public.payout_results_monthly FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'operator') AND user_has_access_to_loja(auth.uid(), loja_id));
CREATE POLICY p_results_gerente_self ON public.payout_results_monthly FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'gerente_unidade') AND user_has_access_to_loja(auth.uid(), loja_id));

DO $verify$
DECLARE v_tables int; v_sources_seed int;
BEGIN
  SELECT COUNT(*) INTO v_tables FROM pg_tables
   WHERE schemaname='public' AND tablename IN ('payout_rules','payout_indicator_sources','payout_results_monthly');
  SELECT COUNT(*) INTO v_sources_seed FROM public.payout_indicator_sources;
  IF v_tables <> 3 THEN RAISE EXCEPTION 'B1 falhou: esperado 3 tabelas, encontrado %', v_tables; END IF;
  IF v_sources_seed < 9 THEN RAISE EXCEPTION 'B1 falhou: seed incompleto (% < 9)', v_sources_seed; END IF;
  RAISE NOTICE 'B1 OK: 3 tabelas + % linhas de mapping', v_sources_seed;
END
$verify$;

COMMIT;