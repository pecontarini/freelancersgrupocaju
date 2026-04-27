CREATE OR REPLACE FUNCTION public.reset_cmv_module(p_unit_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_all boolean := (p_unit_ids IS NULL OR array_length(p_unit_ids, 1) IS NULL);
  v_contagens int := 0;
  v_camara int := 0;
  v_praca int := 0;
  v_inventory int := 0;
  v_movements int := 0;
  v_vendas_ajuste int := 0;
  v_price_history int := 0;
  v_pending_sales int := 0;
  v_inv_tx int := 0;
  v_stock_pos int := 0;
  v_daily_sales int := 0;
BEGIN
  IF v_uid IS NULL OR NOT has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente admin pode zerar o módulo CMV.';
  END IF;

  IF v_all THEN
    DELETE FROM cmv_contagens; GET DIAGNOSTICS v_contagens = ROW_COUNT;
    DELETE FROM cmv_camara; GET DIAGNOSTICS v_camara = ROW_COUNT;
    DELETE FROM cmv_praca; GET DIAGNOSTICS v_praca = ROW_COUNT;
    DELETE FROM cmv_inventory; GET DIAGNOSTICS v_inventory = ROW_COUNT;
    DELETE FROM cmv_movements; GET DIAGNOSTICS v_movements = ROW_COUNT;
    DELETE FROM cmv_vendas_ajuste; GET DIAGNOSTICS v_vendas_ajuste = ROW_COUNT;
    DELETE FROM cmv_price_history; GET DIAGNOSTICS v_price_history = ROW_COUNT;
    DELETE FROM cmv_pending_sales_items; GET DIAGNOSTICS v_pending_sales = ROW_COUNT;
    DELETE FROM inventory_transactions; GET DIAGNOSTICS v_inv_tx = ROW_COUNT;
    DELETE FROM daily_stock_positions; GET DIAGNOSTICS v_stock_pos = ROW_COUNT;
    DELETE FROM daily_sales; GET DIAGNOSTICS v_daily_sales = ROW_COUNT;
  ELSE
    DELETE FROM cmv_contagens WHERE loja_id = ANY(p_unit_ids); GET DIAGNOSTICS v_contagens = ROW_COUNT;
    DELETE FROM cmv_camara WHERE loja_id = ANY(p_unit_ids); GET DIAGNOSTICS v_camara = ROW_COUNT;
    DELETE FROM cmv_praca WHERE loja_id = ANY(p_unit_ids); GET DIAGNOSTICS v_praca = ROW_COUNT;
    DELETE FROM cmv_inventory WHERE loja_id = ANY(p_unit_ids); GET DIAGNOSTICS v_inventory = ROW_COUNT;
    DELETE FROM cmv_movements WHERE loja_id = ANY(p_unit_ids); GET DIAGNOSTICS v_movements = ROW_COUNT;
    DELETE FROM cmv_vendas_ajuste WHERE loja_id = ANY(p_unit_ids); GET DIAGNOSTICS v_vendas_ajuste = ROW_COUNT;
    DELETE FROM cmv_price_history WHERE loja_id = ANY(p_unit_ids); GET DIAGNOSTICS v_price_history = ROW_COUNT;
    DELETE FROM cmv_pending_sales_items WHERE loja_id = ANY(p_unit_ids); GET DIAGNOSTICS v_pending_sales = ROW_COUNT;
    DELETE FROM inventory_transactions WHERE unit_id = ANY(p_unit_ids); GET DIAGNOSTICS v_inv_tx = ROW_COUNT;
    DELETE FROM daily_stock_positions WHERE unit_id = ANY(p_unit_ids); GET DIAGNOSTICS v_stock_pos = ROW_COUNT;
    DELETE FROM daily_sales WHERE unit_id = ANY(p_unit_ids); GET DIAGNOSTICS v_daily_sales = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'scope', CASE WHEN v_all THEN 'all_units' ELSE 'selected_units' END,
    'unit_ids', COALESCE(to_jsonb(p_unit_ids), '[]'::jsonb),
    'cmv_contagens_deleted', v_contagens,
    'cmv_camara_deleted', v_camara,
    'cmv_praca_deleted', v_praca,
    'cmv_inventory_deleted', v_inventory,
    'cmv_movements_deleted', v_movements,
    'cmv_vendas_ajuste_deleted', v_vendas_ajuste,
    'cmv_price_history_deleted', v_price_history,
    'cmv_pending_sales_items_deleted', v_pending_sales,
    'inventory_transactions_deleted', v_inv_tx,
    'daily_stock_positions_deleted', v_stock_pos,
    'daily_sales_deleted', v_daily_sales,
    'executed_at', now()
  );
END;
$$;