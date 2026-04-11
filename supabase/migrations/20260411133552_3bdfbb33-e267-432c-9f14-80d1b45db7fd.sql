
-- 1. items_catalog
CREATE TABLE public.items_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE,
  name text NOT NULL,
  unit text,
  item_type text,
  family text,
  grande_grupo text,
  grupo text,
  subgrupo text,
  is_utensilio boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.items_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view items_catalog"
  ON public.items_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage items_catalog"
  ON public.items_catalog FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. utensilios_config
CREATE TABLE public.utensilios_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  faturamento_mensal numeric NOT NULL DEFAULT 0,
  percentual_budget numeric NOT NULL DEFAULT 0.005,
  budget_mensal numeric GENERATED ALWAYS AS (faturamento_mensal * percentual_budget) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.utensilios_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access utensilios_config"
  ON public.utensilios_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store access utensilios_config"
  ON public.utensilios_config FOR ALL
  TO authenticated
  USING (user_has_access_to_loja(auth.uid(), loja_id))
  WITH CHECK (user_has_access_to_loja(auth.uid(), loja_id));

-- 3. utensilios_items
CREATE TABLE public.utensilios_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_item_id uuid NOT NULL REFERENCES public.items_catalog(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  estoque_minimo integer NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  categoria text,
  area_responsavel text NOT NULL DEFAULT 'Salão',
  ordem_prioridade integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.utensilios_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access utensilios_items"
  ON public.utensilios_items FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store access utensilios_items"
  ON public.utensilios_items FOR ALL
  TO authenticated
  USING (user_has_access_to_loja(auth.uid(), loja_id))
  WITH CHECK (user_has_access_to_loja(auth.uid(), loja_id));

-- 4. utensilios_contagens
CREATE TABLE public.utensilios_contagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  utensilio_item_id uuid NOT NULL REFERENCES public.utensilios_items(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  turno text NOT NULL,
  data_contagem date NOT NULL,
  semana_referencia text NOT NULL,
  quantidade_contada integer NOT NULL DEFAULT 0,
  responsavel text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.utensilios_contagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access utensilios_contagens"
  ON public.utensilios_contagens FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store access utensilios_contagens"
  ON public.utensilios_contagens FOR ALL
  TO authenticated
  USING (user_has_access_to_loja(auth.uid(), loja_id))
  WITH CHECK (user_has_access_to_loja(auth.uid(), loja_id));

-- 5. utensilios_pedidos
CREATE TABLE public.utensilios_pedidos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id uuid NOT NULL REFERENCES public.utensilios_config(id) ON DELETE CASCADE,
  utensilio_item_id uuid NOT NULL REFERENCES public.utensilios_items(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  qtd_deficit integer NOT NULL DEFAULT 0,
  qtd_aprovada integer NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  custo_pedido numeric GENERATED ALWAYS AS (qtd_aprovada * valor_unitario) STORED,
  status text NOT NULL DEFAULT 'OK',
  ajuste_final integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.utensilios_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access utensilios_pedidos"
  ON public.utensilios_pedidos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store access utensilios_pedidos"
  ON public.utensilios_pedidos FOR ALL
  TO authenticated
  USING (user_has_access_to_loja(auth.uid(), loja_id))
  WITH CHECK (user_has_access_to_loja(auth.uid(), loja_id));

-- Indexes
CREATE INDEX idx_items_catalog_is_utensilio ON public.items_catalog(is_utensilio) WHERE is_utensilio = true;
CREATE INDEX idx_utensilios_items_loja ON public.utensilios_items(loja_id);
CREATE INDEX idx_utensilios_contagens_loja_data ON public.utensilios_contagens(loja_id, data_contagem);
CREATE INDEX idx_utensilios_pedidos_config ON public.utensilios_pedidos(config_id);
