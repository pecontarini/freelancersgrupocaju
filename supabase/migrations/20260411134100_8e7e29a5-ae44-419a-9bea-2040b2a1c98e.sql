
-- 1. setores
CREATE TABLE public.setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  loja_id uuid REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access setores" ON public.setores FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers view own store setores" ON public.setores FOR SELECT
  USING (loja_id IS NULL OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Managers manage own store setores" ON public.setores FOR ALL
  USING (user_has_access_to_loja(auth.uid(), loja_id))
  WITH CHECK (user_has_access_to_loja(auth.uid(), loja_id));

-- Seed 5 default sectors (global, no loja_id)
INSERT INTO public.setores (nome, descricao) VALUES
  ('Estoque', 'Estoque central da unidade'),
  ('Cozinha', 'Área de produção culinária'),
  ('Parrilla', 'Área de parrilla e grelhados'),
  ('Bar', 'Área de bar e bebidas'),
  ('Salão', 'Área de salão e atendimento');

-- 2. setor_items
CREATE TABLE public.setor_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid NOT NULL REFERENCES public.items_catalog(id) ON DELETE CASCADE,
  setor_id uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  estoque_minimo integer NOT NULL DEFAULT 0,
  estoque_maximo integer,
  ponto_pedido integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(catalog_item_id, setor_id, loja_id)
);

CREATE INDEX idx_setor_items_loja ON public.setor_items(loja_id);
CREATE INDEX idx_setor_items_setor ON public.setor_items(setor_id);

ALTER TABLE public.setor_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access setor_items" ON public.setor_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers view own store setor_items" ON public.setor_items FOR SELECT
  USING (user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Managers manage own store setor_items" ON public.setor_items FOR INSERT
  WITH CHECK (user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Managers update own store setor_items" ON public.setor_items FOR UPDATE
  USING (user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Managers delete own store setor_items" ON public.setor_items FOR DELETE
  USING (user_has_access_to_loja(auth.uid(), loja_id));

-- 3. inventarios
CREATE TABLE public.inventarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  turno text,
  data_inventario date NOT NULL,
  semana_referencia text,
  responsavel text,
  status text NOT NULL DEFAULT 'ABERTO',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventarios_loja ON public.inventarios(loja_id);
CREATE INDEX idx_inventarios_data ON public.inventarios(data_inventario);

ALTER TABLE public.inventarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access inventarios" ON public.inventarios FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers view own store inventarios" ON public.inventarios FOR SELECT
  USING (user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Managers manage own store inventarios" ON public.inventarios FOR INSERT
  WITH CHECK (user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Managers update own store inventarios" ON public.inventarios FOR UPDATE
  USING (user_has_access_to_loja(auth.uid(), loja_id));

-- 4. inventario_items
CREATE TABLE public.inventario_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id uuid NOT NULL REFERENCES public.inventarios(id) ON DELETE CASCADE,
  setor_item_id uuid NOT NULL REFERENCES public.setor_items(id) ON DELETE CASCADE,
  quantidade_anterior numeric NOT NULL DEFAULT 0,
  quantidade_contada numeric NOT NULL DEFAULT 0,
  variacao numeric GENERATED ALWAYS AS (quantidade_contada - quantidade_anterior) STORED,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventario_items_inventario ON public.inventario_items(inventario_id);

ALTER TABLE public.inventario_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access inventario_items" ON public.inventario_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers view own store inventario_items" ON public.inventario_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.inventarios i
    WHERE i.id = inventario_items.inventario_id
    AND user_has_access_to_loja(auth.uid(), i.loja_id)
  ));

CREATE POLICY "Managers insert own store inventario_items" ON public.inventario_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.inventarios i
    WHERE i.id = inventario_items.inventario_id
    AND user_has_access_to_loja(auth.uid(), i.loja_id)
  ));

CREATE POLICY "Managers update own store inventario_items" ON public.inventario_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.inventarios i
    WHERE i.id = inventario_items.inventario_id
    AND user_has_access_to_loja(auth.uid(), i.loja_id)
  ));

-- 5. movimentacoes_estoque
CREATE TABLE public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_item_id uuid NOT NULL REFERENCES public.setor_items(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  tipo_movimentacao text NOT NULL,
  quantidade numeric NOT NULL,
  setor_destino_id uuid REFERENCES public.setores(id),
  data_movimentacao timestamptz NOT NULL DEFAULT now(),
  responsavel text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_movimentacoes_loja ON public.movimentacoes_estoque(loja_id);
CREATE INDEX idx_movimentacoes_data ON public.movimentacoes_estoque(data_movimentacao);
CREATE INDEX idx_movimentacoes_setor_item ON public.movimentacoes_estoque(setor_item_id);

ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access movimentacoes" ON public.movimentacoes_estoque FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers view own store movimentacoes" ON public.movimentacoes_estoque FOR SELECT
  USING (user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Managers insert own store movimentacoes" ON public.movimentacoes_estoque FOR INSERT
  WITH CHECK (user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Managers update own store movimentacoes" ON public.movimentacoes_estoque FOR UPDATE
  USING (user_has_access_to_loja(auth.uid(), loja_id));
