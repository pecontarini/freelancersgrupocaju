CREATE TABLE public.salmon_efficiency_daily (
  id bigserial PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id),
  transaction_date date NOT NULL,
  initial_stock_kg numeric(8,3) NOT NULL CHECK (initial_stock_kg >= 0),
  transfer_kg numeric(8,3) NOT NULL CHECK (transfer_kg >= 0),
  final_stock_kg numeric(8,3) NOT NULL CHECK (final_stock_kg >= 0),
  consumption_kg numeric(8,3) GENERATED ALWAYS AS
    (initial_stock_kg + transfer_kg - final_stock_kg) STORED,
  revenue_brl numeric(12,2) NOT NULL CHECK (revenue_brl >= 0),
  ratio_kg_per_1k numeric(6,3) GENERATED ALWAYS AS
    (CASE WHEN revenue_brl <= 0 THEN 0
          ELSE (initial_stock_kg + transfer_kg - final_stock_kg)
               * 1000 / revenue_brl END) STORED,
  semaphore text GENERATED ALWAYS AS
    (CASE
       WHEN revenue_brl <= 0 THEN 'gray'
       WHEN (initial_stock_kg + transfer_kg - final_stock_kg) * 1000
            / NULLIF(revenue_brl, 0) <= 1.55 THEN 'green'
       WHEN (initial_stock_kg + transfer_kg - final_stock_kg) * 1000
            / NULLIF(revenue_brl, 0) <= 1.65 THEN 'yellow'
       ELSE 'red'
     END) STORED,
  source text NOT NULL DEFAULT 'sheets_sync',
  source_row_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, transaction_date)
);

CREATE INDEX idx_salmon_eff_loja_date
  ON public.salmon_efficiency_daily (loja_id, transaction_date DESC);

CREATE INDEX idx_salmon_eff_semaphore
  ON public.salmon_efficiency_daily (semaphore)
  WHERE semaphore IN ('yellow','red');

CREATE OR REPLACE FUNCTION public.tg_salmon_eff_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

CREATE TRIGGER tg_salmon_eff_updated_at
  BEFORE UPDATE ON public.salmon_efficiency_daily
  FOR EACH ROW EXECUTE FUNCTION public.tg_salmon_eff_updated_at();

ALTER TABLE public.salmon_efficiency_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_salmon_admin
  ON public.salmon_efficiency_daily
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY p_salmon_operator
  ON public.salmon_efficiency_daily
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'operator'::app_role)
    AND user_has_access_to_loja(auth.uid(), loja_id)
  );

CREATE POLICY p_salmon_gerente
  ON public.salmon_efficiency_daily
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'gerente_unidade'::app_role)
    AND user_has_access_to_loja(auth.uid(), loja_id)
  );

CREATE OR REPLACE VIEW public.v_salmon_daily
WITH (security_invoker = true) AS
SELECT
  id,
  loja_id,
  transaction_date,
  initial_stock_kg,
  transfer_kg,
  final_stock_kg,
  consumption_kg,
  ratio_kg_per_1k,
  semaphore,
  CASE
    WHEN has_role(auth.uid(), 'gerente_unidade'::app_role)
      AND NOT has_role(auth.uid(), 'admin'::app_role)
      AND NOT has_role(auth.uid(), 'operator'::app_role)
    THEN NULL
    ELSE revenue_brl
  END AS revenue_brl,
  source,
  created_at,
  updated_at
FROM public.salmon_efficiency_daily;

CREATE OR REPLACE VIEW public.v_salmon_monthly_summary
WITH (security_invoker = true) AS
SELECT
  loja_id,
  date_trunc('month', transaction_date)::date AS month_ref,
  COUNT(*) AS dias_registrados,
  COUNT(*) FILTER (WHERE semaphore = 'green')  AS dias_verde,
  COUNT(*) FILTER (WHERE semaphore = 'yellow') AS dias_amarelo,
  COUNT(*) FILTER (WHERE semaphore = 'red')    AS dias_vermelho,
  ROUND(AVG(ratio_kg_per_1k)::numeric, 3)      AS ratio_avg,
  ROUND(MIN(ratio_kg_per_1k)::numeric, 3)      AS ratio_best,
  ROUND(MAX(ratio_kg_per_1k)::numeric, 3)      AS ratio_worst,
  SUM(consumption_kg)                          AS consumption_total_kg
FROM public.salmon_efficiency_daily
GROUP BY loja_id, date_trunc('month', transaction_date);

DO $verify$
DECLARE
  v_table_exists boolean;
  v_policies int;
  v_indexes int;
  v_generated_cols int;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='salmon_efficiency_daily')
    INTO v_table_exists;
  SELECT COUNT(*) INTO v_policies FROM pg_policy WHERE polrelid='public.salmon_efficiency_daily'::regclass;
  SELECT COUNT(*) INTO v_indexes FROM pg_indexes WHERE schemaname='public' AND tablename='salmon_efficiency_daily';
  SELECT COUNT(*) INTO v_generated_cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='salmon_efficiency_daily' AND is_generated='ALWAYS';

  IF NOT v_table_exists THEN RAISE EXCEPTION 'sprint1_01: tabela não criada'; END IF;
  IF v_policies <> 3 THEN RAISE EXCEPTION 'sprint1_01: esperado 3 policies, encontrado %', v_policies; END IF;
  IF v_indexes < 3 THEN RAISE EXCEPTION 'sprint1_01: esperado >=3 indexes, encontrado %', v_indexes; END IF;
  IF v_generated_cols <> 3 THEN RAISE EXCEPTION 'sprint1_01: esperado 3 generated cols, encontrado %', v_generated_cols; END IF;

  RAISE NOTICE 'sprint1_01 OK: % policies, % indexes, % generated cols', v_policies, v_indexes, v_generated_cols;
END
$verify$;