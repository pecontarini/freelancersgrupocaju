
CREATE OR REPLACE FUNCTION public.calculate_audit_period(
  p_loja_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  item_id uuid,
  item_name text,
  categoria text,
  unidade text,
  initial_stock numeric,
  initial_cost numeric,
  purchases_qty numeric,
  sales_consumption numeric,
  theoretical_final numeric,
  real_final_stock numeric,
  final_cost numeric,
  divergence numeric,
  financial_loss numeric,
  has_initial_count boolean,
  has_final_count boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Active CMV items
  active_items AS (
    SELECT i.id, i.nome, i.categoria, i.unidade, i.preco_custo_atual
    FROM cmv_items i
    WHERE i.ativo = true
  ),
  -- Initial counts (exact date match only)
  initial AS (
    SELECT c.cmv_item_id, c.quantidade, c.preco_custo_snapshot
    FROM cmv_contagens c
    WHERE c.loja_id = p_loja_id
      AND c.data_contagem = p_start_date
  ),
  -- Final counts (exact date match only)
  final AS (
    SELECT c.cmv_item_id, c.quantidade, c.preco_custo_snapshot
    FROM cmv_contagens c
    WHERE c.loja_id = p_loja_id
      AND c.data_contagem = p_end_date
  ),
  -- Purchases (NFe entries) within the period
  purchases AS (
    SELECT m.cmv_item_id, COALESCE(SUM(m.quantidade), 0) AS total_qty
    FROM cmv_movements m
    WHERE m.loja_id = p_loja_id
      AND m.tipo_movimento = 'entrada'
      AND m.data_movimento >= p_start_date
      AND m.data_movimento <= p_end_date
    GROUP BY m.cmv_item_id
  ),
  -- Sales consumption: daily_sales × cmv_sales_mappings
  sales AS (
    SELECT
      sm.cmv_item_id,
      COALESCE(SUM(ds.quantity * sm.multiplicador), 0) AS total_consumption
    FROM daily_sales ds
    INNER JOIN cmv_sales_mappings sm
      ON UPPER(TRIM(sm.nome_venda)) = UPPER(TRIM(ds.item_name))
    WHERE ds.unit_id = p_loja_id
      AND ds.sale_date >= p_start_date
      AND ds.sale_date <= p_end_date
    GROUP BY sm.cmv_item_id
  )
  SELECT
    ai.id AS item_id,
    ai.nome AS item_name,
    COALESCE(ai.categoria, 'Sem categoria') AS categoria,
    ai.unidade,
    COALESCE(ic.quantidade, 0) AS initial_stock,
    COALESCE(ic.preco_custo_snapshot, ai.preco_custo_atual) AS initial_cost,
    COALESCE(p.total_qty, 0) AS purchases_qty,
    COALESCE(s.total_consumption, 0) AS sales_consumption,
    (COALESCE(ic.quantidade, 0) + COALESCE(p.total_qty, 0) - COALESCE(s.total_consumption, 0)) AS theoretical_final,
    COALESCE(fc.quantidade, 0) AS real_final_stock,
    COALESCE(fc.preco_custo_snapshot, ai.preco_custo_atual) AS final_cost,
    (COALESCE(fc.quantidade, 0) - (COALESCE(ic.quantidade, 0) + COALESCE(p.total_qty, 0) - COALESCE(s.total_consumption, 0))) AS divergence,
    ((COALESCE(ic.quantidade, 0) + COALESCE(p.total_qty, 0) - COALESCE(s.total_consumption, 0)) - COALESCE(fc.quantidade, 0))
      * COALESCE(fc.preco_custo_snapshot, ai.preco_custo_atual) AS financial_loss,
    (ic.cmv_item_id IS NOT NULL) AS has_initial_count,
    (fc.cmv_item_id IS NOT NULL) AS has_final_count
  FROM active_items ai
  LEFT JOIN initial ic ON ic.cmv_item_id = ai.id
  LEFT JOIN final fc ON fc.cmv_item_id = ai.id
  LEFT JOIN purchases p ON p.cmv_item_id = ai.id
  LEFT JOIN sales s ON s.cmv_item_id = ai.id
  WHERE ic.cmv_item_id IS NOT NULL
     OR fc.cmv_item_id IS NOT NULL
     OR p.total_qty > 0
     OR s.total_consumption > 0;
END;
$$;
