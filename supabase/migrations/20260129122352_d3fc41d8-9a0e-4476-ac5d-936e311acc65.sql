-- =====================================================
-- MIGRAÇÃO V2: Portal da Liderança - Modelo de Cargos
-- =====================================================

-- 1. Criar ENUM para família operacional
CREATE TYPE public.familia_operacional AS ENUM ('front', 'back');

-- 2. Criar ENUM para setor back específico
CREATE TYPE public.setor_back AS ENUM ('cozinha', 'bar', 'parrilla', 'sushi');

-- 3. Criar ENUM para categoria do cargo
CREATE TYPE public.categoria_cargo AS ENUM ('gerencia', 'chefia');

-- 4. Criar ENUM para código de meta
CREATE TYPE public.codigo_meta AS ENUM ('nps_salao', 'nps_delivery', 'supervisao', 'conformidade_setor', 'tempo_prato');

-- 5. Criar ENUM para origem de dados
CREATE TYPE public.origem_dado AS ENUM ('sheets', 'pdf', 'kds', 'manual');

-- 6. Criar tabela de cargos
CREATE TABLE public.cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  categoria categoria_cargo NOT NULL,
  familia_operacional familia_operacional NOT NULL,
  setor_back setor_back,
  pote_variavel_max NUMERIC NOT NULL DEFAULT 3000,
  marca_aplicavel JSONB DEFAULT '["caju", "caminito", "nazo", "fosters"]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint: setor_back obrigatório para chefias de back
  CONSTRAINT chk_setor_back_required CHECK (
    (familia_operacional = 'front') OR 
    (familia_operacional = 'back' AND categoria = 'gerencia') OR
    (familia_operacional = 'back' AND categoria = 'chefia' AND setor_back IS NOT NULL)
  )
);

-- 7. Criar tabela de metas por cargo
CREATE TABLE public.metas_cargo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id UUID NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  codigo_meta codigo_meta NOT NULL,
  teto_valor NUMERIC NOT NULL DEFAULT 1000,
  peso NUMERIC NOT NULL DEFAULT 1,
  origem_dado origem_dado NOT NULL DEFAULT 'manual',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(cargo_id, codigo_meta)
);

-- 8. Criar tabela de avaliações (resultados mensais)
CREATE TABLE public.avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  cargo_id UUID NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  codigo_meta codigo_meta NOT NULL,
  score_percentual NUMERIC NOT NULL DEFAULT 0,
  referencia_mes TEXT NOT NULL, -- formato YYYY-MM
  fonte origem_dado NOT NULL DEFAULT 'manual',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(loja_id, cargo_id, codigo_meta, referencia_mes)
);

-- 9. Criar tabela de sincronizações do Google Sheets
CREATE TABLE public.sincronizacoes_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  loja_id UUID REFERENCES public.config_lojas(id) ON DELETE SET NULL,
  referencia_mes TEXT NOT NULL,
  linhas_importadas INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  erro TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 10. Enable RLS
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_cargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sincronizacoes_sheets ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies para cargos (todos podem ler, admin pode gerenciar)
CREATE POLICY "Anyone authenticated can view cargos"
  ON public.cargos FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage cargos"
  ON public.cargos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 12. RLS Policies para metas_cargo
CREATE POLICY "Anyone authenticated can view metas_cargo"
  ON public.metas_cargo FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage metas_cargo"
  ON public.metas_cargo FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 13. RLS Policies para avaliacoes
CREATE POLICY "View avaliacoes based on role"
  ON public.avaliacoes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Only admins can manage avaliacoes"
  ON public.avaliacoes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 14. RLS Policies para sincronizacoes_sheets
CREATE POLICY "View sincronizacoes based on role"
  ON public.sincronizacoes_sheets FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Only admins can manage sincronizacoes"
  ON public.sincronizacoes_sheets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 15. Triggers para updated_at
CREATE TRIGGER update_cargos_updated_at
  BEFORE UPDATE ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_metas_cargo_updated_at
  BEFORE UPDATE ON public.metas_cargo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_avaliacoes_updated_at
  BEFORE UPDATE ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 16. Inserir cargos oficiais
INSERT INTO public.cargos (nome, categoria, familia_operacional, setor_back, pote_variavel_max) VALUES
  ('Gerente de Front', 'gerencia', 'front', NULL, 5000),
  ('Gerente de Back', 'gerencia', 'back', NULL, 5000),
  ('Chefe de Salão', 'chefia', 'front', NULL, 3000),
  ('Chefe de APV', 'chefia', 'front', NULL, 3000),
  ('Chefe de Cozinha', 'chefia', 'back', 'cozinha', 3000),
  ('Chefe de Bar', 'chefia', 'back', 'bar', 3000),
  ('Chefe de Parrilla', 'chefia', 'back', 'parrilla', 3000),
  ('Chefe de Sushi', 'chefia', 'back', 'sushi', 3000);

-- 17. Inserir metas padrão para Gerência
INSERT INTO public.metas_cargo (cargo_id, codigo_meta, teto_valor, peso, origem_dado)
SELECT c.id, m.codigo_meta, m.teto_valor, 1, m.origem_dado
FROM public.cargos c
CROSS JOIN (
  VALUES 
    ('nps_salao'::codigo_meta, 1666.67::numeric, 'sheets'::origem_dado),
    ('nps_delivery'::codigo_meta, 1666.67::numeric, 'sheets'::origem_dado),
    ('supervisao'::codigo_meta, 1666.66::numeric, 'pdf'::origem_dado)
) AS m(codigo_meta, teto_valor, origem_dado)
WHERE c.categoria = 'gerencia';

-- 18. Inserir metas padrão para Chefias Front
INSERT INTO public.metas_cargo (cargo_id, codigo_meta, teto_valor, peso, origem_dado)
SELECT c.id, m.codigo_meta, m.teto_valor, 1, m.origem_dado
FROM public.cargos c
CROSS JOIN (
  VALUES 
    ('nps_salao'::codigo_meta, 1500::numeric, 'sheets'::origem_dado),
    ('supervisao'::codigo_meta, 1500::numeric, 'pdf'::origem_dado)
) AS m(codigo_meta, teto_valor, origem_dado)
WHERE c.categoria = 'chefia' AND c.familia_operacional = 'front';

-- 19. Inserir metas padrão para Chefias Back
INSERT INTO public.metas_cargo (cargo_id, codigo_meta, teto_valor, peso, origem_dado)
SELECT c.id, m.codigo_meta, m.teto_valor, 1, m.origem_dado
FROM public.cargos c
CROSS JOIN (
  VALUES 
    ('conformidade_setor'::codigo_meta, 1000::numeric, 'pdf'::origem_dado),
    ('tempo_prato'::codigo_meta, 1000::numeric, 'kds'::origem_dado),
    ('supervisao'::codigo_meta, 1000::numeric, 'pdf'::origem_dado)
) AS m(codigo_meta, teto_valor, origem_dado)
WHERE c.categoria = 'chefia' AND c.familia_operacional = 'back';