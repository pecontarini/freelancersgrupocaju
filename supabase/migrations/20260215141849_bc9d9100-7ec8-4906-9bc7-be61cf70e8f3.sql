
-- Create a secure RPC function to reset all sales-related data for a unit
CREATE OR REPLACE FUNCTION public.reset_unit_sales_data(target_unit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_daily_sales_count integer;
  v_transactions_count integer;
  v_positions_count integer;
BEGIN
  -- Security: only admins or partners with access
  IF NOT has_role(auth.uid(), 'admin') AND NOT has_role(auth.uid(), 'partner') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta operação.';
  END IF;

  -- 1. Delete daily sales records
  DELETE FROM daily_sales WHERE unit_id = target_unit_id;
  GET DIAGNOSTICS v_daily_sales_count = ROW_COUNT;

  -- 2. Delete sale_deduction inventory transactions
  DELETE FROM inventory_transactions 
  WHERE unit_id = target_unit_id 
    AND transaction_type = 'sale_deduction';
  GET DIAGNOSTICS v_transactions_count = ROW_COUNT;

  -- 3. Reset daily stock positions (recalculation needed)
  DELETE FROM daily_stock_positions WHERE unit_id = target_unit_id;
  GET DIAGNOSTICS v_positions_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'daily_sales_deleted', v_daily_sales_count,
    'transactions_deleted', v_transactions_count,
    'positions_deleted', v_positions_count
  );
END;
$$;
