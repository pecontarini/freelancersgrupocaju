BEGIN;

CREATE OR REPLACE FUNCTION public.classify_payout(p_cargo text, p_indicador text, p_valor numeric)
RETURNS TABLE(breakpoint_atingido numeric, breakpoint_descricao text, payout_brl numeric, direcao text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH rules AS (
    SELECT pr.breakpoint, pr.descricao, pr.payout_brl, pr.direcao
      FROM public.payout_rules pr
     WHERE pr.cargo = p_cargo AND pr.indicador = p_indicador AND pr.is_active = true
       AND pr.valid_from <= current_date
       AND (pr.valid_to IS NULL OR pr.valid_to >= current_date)
  )
  SELECT r.breakpoint, r.descricao, r.payout_brl, r.direcao
    FROM rules r
   WHERE (r.direcao = 'HIGH' AND p_valor >= r.breakpoint)
      OR (r.direcao = 'LOW'  AND p_valor <= r.breakpoint)
   ORDER BY
     CASE WHEN r.direcao = 'HIGH' THEN r.breakpoint END DESC NULLS LAST,
     CASE WHEN r.direcao = 'LOW'  THEN r.breakpoint END ASC  NULLS LAST
   LIMIT 1;
END
$$;
REVOKE EXECUTE ON FUNCTION public.classify_payout(text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.classify_payout(text,text,numeric) TO authenticated;

CREATE OR REPLACE VIEW public.v_payout_jobs_to_compute AS
WITH cargos_ativos AS (
  SELECT DISTINCT cargo, indicador
    FROM public.payout_rules
   WHERE is_active = true AND valid_from <= current_date
     AND (valid_to IS NULL OR valid_to >= current_date)
)
SELECT
  cl.id   AS loja_id,
  cl.code AS loja_code,
  cl.brand,
  cl.nome AS loja_nome,
  ca.cargo,
  ca.indicador,
  date_trunc('month', current_date)::date AS mes_ref,
  pis.source_meta_key,
  pis.parser_fn,
  ss.id   AS sheets_source_id,
  ss.ultimo_status AS source_status
FROM public.config_lojas cl
CROSS JOIN cargos_ativos ca
LEFT JOIN public.payout_indicator_sources pis
  ON pis.indicador = ca.indicador AND pis.is_active = true
  AND (pis.cargo IS NULL OR pis.cargo = ca.cargo)
  AND (pis.brand_filter IS NULL OR pis.brand_filter = cl.brand)
LEFT JOIN public.sheets_sources ss
  ON ss.meta_key = pis.source_meta_key AND ss.ativo = true
WHERE cl.is_active = true;

CREATE OR REPLACE VIEW public.v_payout_consolidated AS
SELECT
  prm.loja_id,
  cl.code AS loja_code,
  cl.brand,
  cl.nome AS loja_nome,
  prm.cargo,
  prm.mes_ref,
  SUM(prm.payout_brl) AS payout_total_brl,
  COUNT(*) FILTER (WHERE prm.payout_brl > 0) AS metas_atingidas,
  COUNT(*) FILTER (WHERE prm.payout_brl = 0) AS metas_zeradas,
  COUNT(*) AS metas_total,
  jsonb_agg(jsonb_build_object(
      'indicador',  prm.indicador,
      'valor',      prm.resultado_valor,
      'breakpoint', prm.breakpoint_descricao,
      'payout',     prm.payout_brl,
      'origem',     prm.source_origin
    ) ORDER BY prm.indicador) AS detalhamento
FROM public.payout_results_monthly prm
JOIN public.config_lojas cl ON cl.id = prm.loja_id
GROUP BY prm.loja_id, cl.code, cl.brand, cl.nome, prm.cargo, prm.mes_ref;

CREATE TABLE IF NOT EXISTS public.payout_role_target (
  id bigserial PRIMARY KEY,
  cargo text NOT NULL UNIQUE,
  remuneracao_total_brl numeric(10,2) NOT NULL,
  source text DEFAULT 'sheets:payout_target_by_role',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.payout_role_target ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_role_target_read_all ON public.payout_role_target FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operator') OR has_role(auth.uid(),'gerente_unidade'));
CREATE POLICY p_role_target_admin ON public.payout_role_target FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='classify_payout') THEN
    RAISE EXCEPTION 'B2 falhou: classify_payout não criada';
  END IF;
  IF (SELECT COUNT(*) FROM pg_views WHERE schemaname='public'
       AND viewname IN ('v_payout_jobs_to_compute','v_payout_consolidated')) <> 2 THEN
    RAISE EXCEPTION 'B2 falhou: views não criadas';
  END IF;
  RAISE NOTICE 'B2 OK: classify_payout + 2 views + payout_role_target';
END
$verify$;

COMMIT;