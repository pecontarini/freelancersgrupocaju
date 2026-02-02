-- Create table for daily physical counts with cost snapshot
CREATE TABLE public.cmv_contagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cmv_item_id UUID NOT NULL REFERENCES public.cmv_items(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  data_contagem DATE NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  preco_custo_snapshot NUMERIC NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one count per item per store per day
  UNIQUE(cmv_item_id, loja_id, data_contagem)
);

-- Enable RLS
ALTER TABLE public.cmv_contagens ENABLE ROW LEVEL SECURITY;

-- Policies for cmv_contagens
CREATE POLICY "View cmv_contagens based on role"
ON public.cmv_contagens
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Insert cmv_contagens based on role"
ON public.cmv_contagens
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Update cmv_contagens based on role"
ON public.cmv_contagens
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Delete cmv_contagens admin only"
ON public.cmv_contagens
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_cmv_contagens_loja_data ON public.cmv_contagens(loja_id, data_contagem);
CREATE INDEX idx_cmv_contagens_item_loja ON public.cmv_contagens(cmv_item_id, loja_id);

-- Add trigger for updated_at
CREATE TRIGGER update_cmv_contagens_updated_at
BEFORE UPDATE ON public.cmv_contagens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();