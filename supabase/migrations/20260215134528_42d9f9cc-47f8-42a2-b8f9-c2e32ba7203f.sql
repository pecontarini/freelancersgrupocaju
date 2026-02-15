
-- 1. Create transaction_type enum
CREATE TYPE public.inventory_transaction_type AS ENUM (
  'purchase',
  'sale_deduction',
  'waste',
  'audit_adjustment',
  'transfer_in',
  'transfer_out'
);

-- 2. Immutable ledger table
CREATE TABLE public.inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id UUID NOT NULL REFERENCES public.cmv_items(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  quantity NUMERIC NOT NULL,
  transaction_type public.inventory_transaction_type NOT NULL,
  reference_id TEXT NULL,
  notes TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_tx_ingredient_unit_date ON public.inventory_transactions (ingredient_id, unit_id, date);
CREATE INDEX idx_inv_tx_unit_date ON public.inventory_transactions (unit_id, date);
CREATE INDEX idx_inv_tx_type ON public.inventory_transactions (transaction_type);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View inventory_transactions based on role"
  ON public.inventory_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), unit_id));

CREATE POLICY "Insert inventory_transactions based on role"
  ON public.inventory_transactions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), unit_id));

CREATE POLICY "Delete inventory_transactions admin only"
  ON public.inventory_transactions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Daily stock snapshot table
CREATE TABLE public.daily_stock_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  ingredient_id UUID NOT NULL REFERENCES public.cmv_items(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  total_entry NUMERIC NOT NULL DEFAULT 0,
  total_sales NUMERIC NOT NULL DEFAULT 0,
  total_waste NUMERIC NOT NULL DEFAULT 0,
  theoretical_balance NUMERIC NOT NULL DEFAULT 0,
  physical_count NUMERIC NULL,
  divergence NUMERIC NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, ingredient_id, unit_id)
);

CREATE INDEX idx_dsp_unit_date ON public.daily_stock_positions (unit_id, date);
CREATE INDEX idx_dsp_ingredient_date ON public.daily_stock_positions (ingredient_id, date);

ALTER TABLE public.daily_stock_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View daily_stock_positions based on role"
  ON public.daily_stock_positions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), unit_id));

CREATE POLICY "Manage daily_stock_positions based on role"
  ON public.daily_stock_positions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), unit_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), unit_id));

-- 4. DB function to build daily snapshot for a given unit+date
CREATE OR REPLACE FUNCTION public.build_daily_stock_snapshot(p_unit_id UUID, p_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO daily_stock_positions (date, ingredient_id, unit_id, opening_balance, total_entry, total_sales, total_waste, theoretical_balance, physical_count, divergence)
  SELECT
    p_date,
    i.id,
    p_unit_id,
    -- opening = previous day's theoretical or physical if exists
    COALESCE(
      (SELECT COALESCE(dsp.physical_count, dsp.theoretical_balance)
       FROM daily_stock_positions dsp
       WHERE dsp.ingredient_id = i.id AND dsp.unit_id = p_unit_id AND dsp.date = p_date - 1),
      -- fallback: last known contagem
      (SELECT c.quantidade FROM cmv_contagens c
       WHERE c.cmv_item_id = i.id AND c.loja_id = p_unit_id AND c.data_contagem <= p_date
       ORDER BY c.data_contagem DESC LIMIT 1),
      0
    ) AS opening_balance,
    -- entries (purchases + transfer_in)
    COALESCE((SELECT SUM(t.quantity) FROM inventory_transactions t
      WHERE t.ingredient_id = i.id AND t.unit_id = p_unit_id
        AND t.date::date = p_date
        AND t.transaction_type IN ('purchase', 'transfer_in')), 0) AS total_entry,
    -- sales deductions (stored as negative, so ABS)
    COALESCE(ABS((SELECT SUM(t.quantity) FROM inventory_transactions t
      WHERE t.ingredient_id = i.id AND t.unit_id = p_unit_id
        AND t.date::date = p_date
        AND t.transaction_type = 'sale_deduction')), 0) AS total_sales,
    -- waste (stored as negative, so ABS)
    COALESCE(ABS((SELECT SUM(t.quantity) FROM inventory_transactions t
      WHERE t.ingredient_id = i.id AND t.unit_id = p_unit_id
        AND t.date::date = p_date
        AND t.transaction_type = 'waste')), 0) AS total_waste,
    -- theoretical = opening + entry - sales - waste
    0, -- placeholder, computed below
    -- physical_count from contagens if exists
    (SELECT c.quantidade FROM cmv_contagens c
     WHERE c.cmv_item_id = i.id AND c.loja_id = p_unit_id AND c.data_contagem = p_date),
    NULL -- divergence placeholder
  FROM cmv_items i
  WHERE i.ativo = true
    AND (
      EXISTS (SELECT 1 FROM inventory_transactions t WHERE t.ingredient_id = i.id AND t.unit_id = p_unit_id AND t.date::date = p_date)
      OR EXISTS (SELECT 1 FROM cmv_contagens c WHERE c.cmv_item_id = i.id AND c.loja_id = p_unit_id AND c.data_contagem = p_date)
      OR EXISTS (SELECT 1 FROM daily_stock_positions dsp WHERE dsp.ingredient_id = i.id AND dsp.unit_id = p_unit_id AND dsp.date = p_date - 1)
    )
  ON CONFLICT (date, ingredient_id, unit_id) DO UPDATE SET
    opening_balance = EXCLUDED.opening_balance,
    total_entry = EXCLUDED.total_entry,
    total_sales = EXCLUDED.total_sales,
    total_waste = EXCLUDED.total_waste,
    updated_at = now();

  -- Now compute theoretical_balance and divergence
  UPDATE daily_stock_positions
  SET
    theoretical_balance = opening_balance + total_entry - total_sales - total_waste,
    divergence = CASE WHEN physical_count IS NOT NULL
      THEN physical_count - (opening_balance + total_entry - total_sales - total_waste)
      ELSE NULL END,
    updated_at = now()
  WHERE unit_id = p_unit_id AND date = p_date;
END;
$$;
