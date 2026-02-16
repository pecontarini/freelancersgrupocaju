
-- RPC to compute Kardex daily positions on-the-fly from legacy tables
CREATE OR REPLACE FUNCTION public.compute_kardex_daily(
  p_unit_id uuid,
  p_ingredient_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  day date,
  opening_balance numeric,
  total_entry numeric,
  total_sales numeric,
  total_waste numeric,
  theoretical_balance numeric,
  physical_count numeric,
  divergence numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_day date;
  running_balance numeric := 0;
  day_entries numeric;
  day_sales numeric;
  day_waste numeric;
  day_count numeric;
  anchor_count numeric;
BEGIN
  -- Find the most recent physical count on or before start_date as anchor
  SELECT c.quantidade INTO anchor_count
  FROM cmv_contagens c
  WHERE c.loja_id = p_unit_id
    AND c.cmv_item_id = p_ingredient_id
    AND c.data_contagem <= p_start_date
  ORDER BY c.data_contagem DESC
  LIMIT 1;

  running_balance := COALESCE(anchor_count, 0);

  -- Loop through each day in the range
  FOR current_day IN SELECT d::date FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d
  LOOP
    -- Entries from cmv_movements (tipo_movimento = 'entrada')
    SELECT COALESCE(SUM(m.quantidade), 0) INTO day_entries
    FROM cmv_movements m
    WHERE m.loja_id = p_unit_id
      AND m.cmv_item_id = p_ingredient_id
      AND m.data_movimento = current_day
      AND m.tipo_movimento = 'entrada';

    -- Also check inventory_transactions for purchases
    day_entries := day_entries + COALESCE((
      SELECT SUM(it.quantity)
      FROM inventory_transactions it
      WHERE it.unit_id = p_unit_id
        AND it.ingredient_id = p_ingredient_id
        AND it.date::date = current_day
        AND it.transaction_type IN ('purchase', 'transfer_in')
    ), 0);

    -- Sales consumption from daily_sales + cmv_sales_mappings
    SELECT COALESCE(SUM(ds.quantity * sm.multiplicador), 0) INTO day_sales
    FROM daily_sales ds
    JOIN cmv_sales_mappings sm ON UPPER(TRIM(sm.nome_venda)) = UPPER(TRIM(ds.item_name))
    WHERE ds.unit_id = p_unit_id
      AND sm.cmv_item_id = p_ingredient_id
      AND ds.sale_date = current_day;

    -- Also check inventory_transactions for sale_deduction
    day_sales := day_sales + COALESCE((
      SELECT SUM(it.quantity)
      FROM inventory_transactions it
      WHERE it.unit_id = p_unit_id
        AND it.ingredient_id = p_ingredient_id
        AND it.date::date = current_day
        AND it.transaction_type = 'sale_deduction'
    ), 0);

    -- Waste from inventory_transactions
    SELECT COALESCE(SUM(it.quantity), 0) INTO day_waste
    FROM inventory_transactions it
    WHERE it.unit_id = p_unit_id
      AND it.ingredient_id = p_ingredient_id
      AND it.date::date = current_day
      AND it.transaction_type = 'waste';

    -- Also waste from cmv_movements
    day_waste := day_waste + COALESCE((
      SELECT SUM(m.quantidade)
      FROM cmv_movements m
      WHERE m.loja_id = p_unit_id
        AND m.cmv_item_id = p_ingredient_id
        AND m.data_movimento = current_day
        AND m.tipo_movimento IN ('desperdicio', 'saida')
    ), 0);

    -- Physical count for this day
    SELECT c.quantidade INTO day_count
    FROM cmv_contagens c
    WHERE c.loja_id = p_unit_id
      AND c.cmv_item_id = p_ingredient_id
      AND c.data_contagem = current_day;

    -- Set opening balance
    day := current_day;
    opening_balance := running_balance;
    total_entry := day_entries;
    total_sales := day_sales;
    total_waste := day_waste;
    theoretical_balance := running_balance + day_entries - day_sales - day_waste;
    physical_count := day_count;
    
    IF day_count IS NOT NULL THEN
      divergence := day_count - theoretical_balance;
    ELSE
      divergence := NULL;
    END IF;

    RETURN NEXT;

    -- Update running balance: if physical count exists, use it (anchor), otherwise use theoretical
    IF day_count IS NOT NULL THEN
      running_balance := day_count;
    ELSE
      running_balance := theoretical_balance;
    END IF;
  END LOOP;
END;
$$;
