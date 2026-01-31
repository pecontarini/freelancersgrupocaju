-- =====================================================
-- CMV (Custo de Mercadorias Vendidas) - Módulo Carnes
-- =====================================================

-- Tabela de itens de estoque (carnes porcionadas)
CREATE TABLE public.cmv_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'kg',
  peso_padrao_g NUMERIC, -- Peso padrão em gramas (ex: 250g para picanha)
  preco_custo_atual NUMERIC NOT NULL DEFAULT 0,
  categoria TEXT DEFAULT 'carne',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de mapeamento de vendas (vincula nome do PDF ao item de estoque)
CREATE TABLE public.cmv_sales_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_venda TEXT NOT NULL UNIQUE,
  cmv_item_id UUID NOT NULL REFERENCES public.cmv_items(id) ON DELETE CASCADE,
  multiplicador NUMERIC NOT NULL DEFAULT 1,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de movimentações (entradas, saídas, inventário)
CREATE TABLE public.cmv_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cmv_item_id UUID NOT NULL REFERENCES public.cmv_items(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  tipo_movimento TEXT NOT NULL CHECK (tipo_movimento IN ('entrada', 'saida', 'inventario')),
  quantidade NUMERIC NOT NULL,
  preco_unitario NUMERIC,
  data_movimento DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de inventário atual por loja
CREATE TABLE public.cmv_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cmv_item_id UUID NOT NULL REFERENCES public.cmv_items(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  quantidade_atual NUMERIC NOT NULL DEFAULT 0,
  ultima_contagem DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cmv_item_id, loja_id)
);

-- Enable RLS
ALTER TABLE public.cmv_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmv_sales_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmv_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmv_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cmv_items (admin manages, all authenticated can view)
CREATE POLICY "Anyone authenticated can view cmv_items"
  ON public.cmv_items FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage cmv_items"
  ON public.cmv_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for cmv_sales_mappings (admin manages, all authenticated can view)
CREATE POLICY "Anyone authenticated can view cmv_sales_mappings"
  ON public.cmv_sales_mappings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage cmv_sales_mappings"
  ON public.cmv_sales_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for cmv_movements (based on store access)
CREATE POLICY "View cmv_movements based on role"
  ON public.cmv_movements FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Insert cmv_movements based on role"
  ON public.cmv_movements FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Update cmv_movements based on role"
  ON public.cmv_movements FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Delete cmv_movements admin only"
  ON public.cmv_movements FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for cmv_inventory (based on store access)
CREATE POLICY "View cmv_inventory based on role"
  ON public.cmv_inventory FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Manage cmv_inventory admin only"
  ON public.cmv_inventory FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create update trigger for updated_at columns
CREATE TRIGGER update_cmv_items_updated_at
  BEFORE UPDATE ON public.cmv_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cmv_sales_mappings_updated_at
  BEFORE UPDATE ON public.cmv_sales_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cmv_inventory_updated_at
  BEFORE UPDATE ON public.cmv_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_cmv_movements_item_id ON public.cmv_movements(cmv_item_id);
CREATE INDEX idx_cmv_movements_loja_id ON public.cmv_movements(loja_id);
CREATE INDEX idx_cmv_movements_data ON public.cmv_movements(data_movimento);
CREATE INDEX idx_cmv_inventory_loja ON public.cmv_inventory(loja_id);
CREATE INDEX idx_cmv_sales_mappings_nome ON public.cmv_sales_mappings(nome_venda);