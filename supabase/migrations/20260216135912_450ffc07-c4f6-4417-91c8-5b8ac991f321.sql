
DROP FUNCTION IF EXISTS public.calculate_audit_period(uuid, date, date);

CREATE OR REPLACE FUNCTION public.calculate_audit_period(p_loja_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(
   item_id uuid,
   item_name text,
   categoria text,
   unidade text,
   initial_stock numeric,
   initial_cost numeric,
   purchases_qty numeric,
   sales_consumption numeric,
   waste_qty numeric,
   transfers_qty numeric,
   theoretical_final numeric,
   real_final_stock numeric,
   final_cost numeric,
   divergence numeric,
   financial_loss numeric,
   has_initial_count boolean,
   has_final_count boolean
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH
  active_items AS (
    SELECT i.id, i.nome, i.categoria, i.unidade, i.preco_custo_atual
    FROM cmv_items i
    WHERE i.ativo = true
  ),
  initial AS (
    SELECT c.cmv_item_id, c.quantidade, c.preco_custo_snapshot
    FROM cmv_contagens c
    WHERE c.loja_id = p_loja_id AND c.data_contagem = p_start_date
  ),
  final AS (
    SELECT c.cmv_item_id, c.quantidade, c.preco_custo_snapshot
    FROM cmv_contagens c
    WHERE c.loja_id = p_loja_id AND c.data_contagem = p_end_date
  ),
  entries_it AS (
    SELECT t.ingredient_id, COALESCE(SUM(ABS(t.quantity)), 0::numeric) AS total_qty
    FROM inventory_transactions t
    WHERE t.unit_id = p_loja_id
      AND t.transaction_type IN ('purchase', 'transfer_in')
      AND t.date::date >= p_start_date AND t.date::date <= p_end_date
    GROUP BY t.ingredient_id
  ),
  entries_legacy AS (
    SELECT m.cmv_item_id AS ingredient_id, COALESCE(SUM(m.quantidade), 0::numeric) AS total_qty
    FROM cmv_movements m
    WHERE m.loja_id = p_loja_id
      AND m.tipo_movimento = 'entrada'
      AND m.data_movimento >= p_start_date AND m.data_movimento <= p_end_date
      AND NOT EXISTS (
        SELECT 1 FROM inventory_transactions t2
        WHERE t2.ingredient_id = m.cmv_item_id AND t2.unit_id = p_loja_id
          AND t2.transaction_type = 'purchase'
          AND t2.date::date >= p_start_date AND t2.date::date <= p_end_date
      )
    GROUP BY m.cmv_item_id
  ),
  all_entries AS (
    SELECT ingredient_id, SUM(total_qty) AS total_qty
    FROM (SELECT * FROM entries_it UNION ALL SELECT * FROM entries_legacy) combined
    GROUP BY ingredient_id
  ),
  sales_exits AS (
    SELECT t.ingredient_id, COALESCE(SUM(ABS(t.quantity)), 0::numeric) AS total_qty
    FROM inventory_transactions t
    WHERE t.unit_id = p_loja_id AND t.transaction_type = 'sale_deduction'
      AND t.date::date >= p_start_date AND t.date::date <= p_end_date
    GROUP BY t.ingredient_id
  ),
  waste_exits AS (
    SELECT t.ingredient_id, COALESCE(SUM(ABS(t.quantity)), 0::numeric) AS total_qty
    FROM inventory_transactions t
    WHERE t.unit_id = p_loja_id AND t.transaction_type = 'waste'
      AND t.date::date >= p_start_date AND t.date::date <= p_end_date
    GROUP BY t.ingredient_id
  ),
  transfer_exits AS (
    SELECT t.ingredient_id, COALESCE(SUM(ABS(t.quantity)), 0::numeric) AS total_qty
    FROM inventory_transactions t
    WHERE t.unit_id = p_loja_id AND t.transaction_type = 'transfer_out'
      AND t.date::date >= p_start_date AND t.date::date <= p_end_date
    GROUP BY t.ingredient_id
  ),
  sales_fallback AS (
    SELECT sm.cmv_item_id AS ingredient_id,
      COALESCE(SUM(ds.quantity * sm.multiplicador), 0::numeric) AS total_qty
    FROM daily_sales ds
    INNER JOIN cmv_sales_mappings sm ON UPPER(TRIM(sm.nome_venda)) = UPPER(TRIM(ds.item_name))
    WHERE ds.unit_id = p_loja_id
      AND ds.sale_date >= p_start_date AND ds.sale_date <= p_end_date
      AND NOT EXISTS (
        SELECT 1 FROM inventory_transactions t3
        WHERE t3.ingredient_id = sm.cmv_item_id AND t3.unit_id = p_loja_id
          AND t3.transaction_type = 'sale_deduction'
          AND t3.date::date >= p_start_date AND t3.date::date <= p_end_date
      )
    GROUP BY sm.cmv_item_id
  ),
  all_sales AS (
    SELECT ingredient_id, SUM(total_qty) AS total_qty
    FROM (SELECT * FROM sales_exits UNION ALL SELECT * FROM sales_fallback) cs
    GROUP BY ingredient_id
  )
  SELECT
    ai.id AS item_id,
    ai.nome AS item_name,
    COALESCE(ai.categoria, 'Sem categoria') AS categoria,
    ai.unidade,
    COALESCE(ic.quantidade, 0::numeric) AS initial_stock,
    COALESCE(ic.preco_custo_snapshot, ai.preco_custo_atual) AS initial_cost,
    COALESCE(e.total_qty, 0::numeric) AS purchases_qty,
    COALESCE(s.total_qty, 0::numeric) AS sales_consumption,
    COALESCE(w.total_qty, 0::numeric) AS waste_qty,
    COALESCE(tr.total_qty, 0::numeric) AS transfers_qty,
    (COALESCE(ic.quantidade, 0::numeric) + COALESCE(e.total_qty, 0::numeric)
     - COALESCE(s.total_qty, 0::numeric) - COALESCE(w.total_qty, 0::numeric)
     - COALESCE(tr.total_qty, 0::numeric)) AS theoretical_final,
    COALESCE(fc.quantidade, 0::numeric) AS real_final_stock,
    COALESCE(fc.preco_custo_snapshot, ai.preco_custo_atual) AS final_cost,
    (COALESCE(fc.quantidade, 0::numeric)
     - (COALESCE(ic.quantidade, 0::numeric) + COALESCE(e.total_qty, 0::numeric)
        - COALESCE(s.total_qty, 0::numeric) - COALESCE(w.total_qty, 0::numeric)
        - COALESCE(tr.total_qty, 0::numeric))) AS divergence,
    ABS(COALESCE(fc.quantidade, 0::numeric)
     - (COALESCE(ic.quantidade, 0::numeric) + COALESCE(e.total_qty, 0::numeric)
        - COALESCE(s.total_qty, 0::numeric) - COALESCE(w.total_qty, 0::numeric)
        - COALESCE(tr.total_qty, 0::numeric)))
     * COALESCE(fc.preco_custo_snapshot, ai.preco_custo_atual) AS financial_loss,
    (ic.cmv_item_id IS NOT NULL) AS has_initial_count,
    (fc.cmv_item_id IS NOT NULL) AS has_final_count
  FROM active_items ai
  LEFT JOIN initial ic ON ic.cmv_item_id = ai.id
  LEFT JOIN final fc ON fc.cmv_item_id = ai.id
  LEFT JOIN all_entries e ON e.ingredient_id = ai.id
  LEFT JOIN all_sales s ON s.ingredient_id = ai.id
  LEFT JOIN waste_exits w ON w.ingredient_id = ai.id
  LEFT JOIN transfer_exits tr ON tr.ingredient_id = ai.id
  WHERE ic.cmv_item_id IS NOT NULL
     OR fc.cmv_item_id IS NOT NULL
     OR e.total_qty > 0
     OR s.total_qty > 0
     OR w.total_qty > 0
     OR tr.total_qty > 0;
END;
$function$;
