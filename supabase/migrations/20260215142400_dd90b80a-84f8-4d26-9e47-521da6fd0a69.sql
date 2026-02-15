
-- Create function to calculate realtime stock positions based on rolling inventory
-- Anchor: last physical count; Delta: all transactions after that count
CREATE OR REPLACE FUNCTION public.get_realtime_stock_positions(p_unit_id uuid)
RETURNS TABLE(
  item_id uuid,
  item_name text,
  categoria text,
  unidade text,
  last_count_qty numeric,
  last_count_date date,
  entries_qty numeric,
  exits_qty numeric,
  current_qty numeric,
  preco_custo_atual numeric,
  current_value numeric,
  days_since_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Find the last physical count for each item in this unit
  last_counts AS (
    SELECT DISTINCT ON (c.cmv_item_id)
      c.cmv_item_id,
      c.quantidade,
      c.data_contagem,
      c.preco_custo_snapshot
    FROM cmv_contagens c
    WHERE c.loja_id = p_unit_id
    ORDER BY c.cmv_item_id, c.data_contagem DESC
  ),
  -- Sum entries after the last count date (purchases, transfer_in)
  entries AS (
    SELECT
      t.ingredient_id,
      COALESCE(SUM(t.quantity), 0) AS total_in
    FROM inventory_transactions t
    LEFT JOIN last_counts lc ON lc.cmv_item_id = t.ingredient_id
    WHERE t.unit_id = p_unit_id
      AND t.transaction_type IN ('purchase', 'transfer_in')
      AND t.date > COALESCE(lc.data_contagem::timestamp with time zone, '1970-01-01'::timestamp with time zone)
    GROUP BY t.ingredient_id
  ),
  -- Sum exits after the last count date (sale_deduction, waste, transfer_out)
  exits AS (
    SELECT
      t.ingredient_id,
      COALESCE(SUM(ABS(t.quantity)), 0) AS total_out
    FROM inventory_transactions t
    LEFT JOIN last_counts lc ON lc.cmv_item_id = t.ingredient_id
    WHERE t.unit_id = p_unit_id
      AND t.transaction_type IN ('sale_deduction', 'waste', 'transfer_out')
      AND t.date > COALESCE(lc.data_contagem::timestamp with time zone, '1970-01-01'::timestamp with time zone)
    GROUP BY t.ingredient_id
  ),
  -- Also include legacy cmv_movements entries after the last count
  legacy_entries AS (
    SELECT
      m.cmv_item_id AS ingredient_id,
      COALESCE(SUM(m.quantidade), 0) AS total_in
    FROM cmv_movements m
    LEFT JOIN last_counts lc ON lc.cmv_item_id = m.cmv_item_id
    WHERE m.loja_id = p_unit_id
      AND m.tipo_movimento = 'entrada'
      AND m.data_movimento > COALESCE(lc.data_contagem, '1970-01-01'::date)
    GROUP BY m.cmv_item_id
  )
  SELECT
    i.id AS item_id,
    i.nome AS item_name,
    COALESCE(i.categoria, 'Sem categoria') AS categoria,
    i.unidade,
    COALESCE(lc.quantidade, 0) AS last_count_qty,
    lc.data_contagem AS last_count_date,
    (COALESCE(e.total_in, 0) + COALESCE(le.total_in, 0)) AS entries_qty,
    COALESCE(ex.total_out, 0) AS exits_qty,
    (COALESCE(lc.quantidade, 0) + COALESCE(e.total_in, 0) + COALESCE(le.total_in, 0) - COALESCE(ex.total_out, 0)) AS current_qty,
    i.preco_custo_atual,
    (COALESCE(lc.quantidade, 0) + COALESCE(e.total_in, 0) + COALESCE(le.total_in, 0) - COALESCE(ex.total_out, 0)) * i.preco_custo_atual AS current_value,
    CASE WHEN lc.data_contagem IS NOT NULL
      THEN (CURRENT_DATE - lc.data_contagem)::integer
      ELSE NULL
    END AS days_since_count
  FROM cmv_items i
  LEFT JOIN last_counts lc ON lc.cmv_item_id = i.id
  LEFT JOIN entries e ON e.ingredient_id = i.id
  LEFT JOIN exits ex ON ex.ingredient_id = i.id
  LEFT JOIN legacy_entries le ON le.ingredient_id = i.id
  WHERE i.ativo = true
    -- Only return items that have some data for this unit
    AND (
      lc.cmv_item_id IS NOT NULL
      OR e.ingredient_id IS NOT NULL
      OR ex.ingredient_id IS NOT NULL
      OR le.ingredient_id IS NOT NULL
    );
END;
$$;
