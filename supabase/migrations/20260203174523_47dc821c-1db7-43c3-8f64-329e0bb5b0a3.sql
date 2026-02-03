-- Create table to track pending sales items (unmapped items from sales reports)
CREATE TABLE IF NOT EXISTS public.cmv_pending_sales_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_venda_normalizado text NOT NULL UNIQUE,
  nome_venda_original text NOT NULL,
  primeira_ocorrencia date NOT NULL DEFAULT CURRENT_DATE,
  ultima_ocorrencia date NOT NULL DEFAULT CURRENT_DATE,
  total_ocorrencias integer NOT NULL DEFAULT 1,
  loja_id uuid REFERENCES public.config_lojas(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ignorado')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add unique index on nome_venda (normalized) for cmv_sales_mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_cmv_sales_mappings_nome_venda_unique 
ON public.cmv_sales_mappings (UPPER(TRIM(nome_venda)));

-- Enable RLS
ALTER TABLE public.cmv_pending_sales_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for pending items
CREATE POLICY "Anyone authenticated can view cmv_pending_sales_items"
ON public.cmv_pending_sales_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage cmv_pending_sales_items"
ON public.cmv_pending_sales_items FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Function to normalize sales item names
CREATE OR REPLACE FUNCTION normalize_sales_item_name(name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN UPPER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')));
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_cmv_pending_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cmv_pending_sales_items_updated_at
BEFORE UPDATE ON public.cmv_pending_sales_items
FOR EACH ROW EXECUTE FUNCTION update_cmv_pending_updated_at();