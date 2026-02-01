-- Create price history table for tracking cost changes
CREATE TABLE public.cmv_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cmv_item_id UUID NOT NULL REFERENCES public.cmv_items(id) ON DELETE CASCADE,
  preco_anterior NUMERIC NOT NULL,
  preco_novo NUMERIC NOT NULL,
  fonte TEXT NOT NULL DEFAULT 'nfe', -- nfe, manual
  referencia_nf TEXT, -- NFe number reference
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cmv_price_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone authenticated can view cmv_price_history"
  ON public.cmv_price_history FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage cmv_price_history"
  ON public.cmv_price_history FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add index for faster queries
CREATE INDEX idx_cmv_price_history_item ON public.cmv_price_history(cmv_item_id);
CREATE INDEX idx_cmv_price_history_date ON public.cmv_price_history(created_at DESC);