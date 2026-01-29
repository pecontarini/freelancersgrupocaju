-- ================================================
-- MODULE 1 & 2: Google Sheets Multi-Link Staging
-- ================================================

-- Table to store multiple sheets sources (links)
CREATE TABLE public.sheets_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  gid TEXT DEFAULT '0',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_sincronizacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sheets_sources ENABLE ROW LEVEL SECURITY;

-- Only admins can manage sheets sources
CREATE POLICY "Only admins can manage sheets_sources" 
ON public.sheets_sources 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view sheets_sources" 
ON public.sheets_sources 
FOR SELECT 
USING (true);

-- Staging table for raw imported data (before normalization)
CREATE TABLE public.sheets_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.sheets_sources(id) ON DELETE CASCADE,
  sync_id UUID REFERENCES public.sincronizacoes_sheets(id) ON DELETE SET NULL,
  unidade_raw TEXT NOT NULL,
  unidade_normalizada TEXT,
  loja_id UUID REFERENCES public.config_lojas(id),
  data_referencia DATE NOT NULL,
  faturamento NUMERIC NOT NULL DEFAULT 0,
  nps NUMERIC,
  nota_reclamacao NUMERIC,
  tipo_operacao TEXT CHECK (tipo_operacao IN ('salao', 'delivery')),
  is_grave BOOLEAN GENERATED ALWAYS AS (nota_reclamacao IS NOT NULL AND nota_reclamacao <= 3) STORED,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sheets_staging ENABLE ROW LEVEL SECURITY;

-- Only admins can manage staging data
CREATE POLICY "Only admins can manage sheets_staging" 
ON public.sheets_staging 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view staging for their stores" 
ON public.sheets_staging 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

-- Create indexes for performance
CREATE INDEX idx_sheets_staging_source ON public.sheets_staging(source_id);
CREATE INDEX idx_sheets_staging_loja ON public.sheets_staging(loja_id);
CREATE INDEX idx_sheets_staging_date ON public.sheets_staging(data_referencia);
CREATE INDEX idx_sheets_staging_processed ON public.sheets_staging(processed);

-- ================================================
-- MODULE 3: Central de Reclamações
-- ================================================

-- Complaints table
CREATE TABLE public.reclamacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.config_lojas(id),
  fonte TEXT NOT NULL CHECK (fonte IN ('google', 'ifood', 'tripadvisor', 'getin', 'manual', 'sheets')),
  tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN ('salao', 'delivery')),
  data_reclamacao DATE NOT NULL DEFAULT CURRENT_DATE,
  nota_reclamacao NUMERIC NOT NULL CHECK (nota_reclamacao >= 1 AND nota_reclamacao <= 5),
  is_grave BOOLEAN GENERATED ALWAYS AS (nota_reclamacao <= 3) STORED,
  texto_original TEXT,
  resumo_ia TEXT,
  temas JSONB DEFAULT '[]'::jsonb,
  palavras_chave JSONB DEFAULT '[]'::jsonb,
  anexo_url TEXT,
  referencia_mes TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reclamacoes ENABLE ROW LEVEL SECURITY;

-- Admins can manage all complaints
CREATE POLICY "Admins can manage reclamacoes" 
ON public.reclamacoes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view complaints for their stores
CREATE POLICY "View reclamacoes by store access" 
ON public.reclamacoes 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

-- Users can insert complaints for their stores
CREATE POLICY "Insert reclamacoes by store access" 
ON public.reclamacoes 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

-- Create indexes
CREATE INDEX idx_reclamacoes_loja ON public.reclamacoes(loja_id);
CREATE INDEX idx_reclamacoes_data ON public.reclamacoes(data_reclamacao);
CREATE INDEX idx_reclamacoes_referencia ON public.reclamacoes(referencia_mes);
CREATE INDEX idx_reclamacoes_grave ON public.reclamacoes(is_grave);
CREATE INDEX idx_reclamacoes_fonte ON public.reclamacoes(fonte);

-- Trigger for updated_at
CREATE TRIGGER update_reclamacoes_updated_at
BEFORE UPDATE ON public.reclamacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sheets_sources_updated_at
BEFORE UPDATE ON public.sheets_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();