-- ============================================
-- Webhooks n8n para Central de Reclamações
-- ============================================

-- 1. Tabela de endpoints (uma por automação do n8n)
CREATE TABLE public.n8n_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  secret_token text NOT NULL,
  tipo_dado text NOT NULL DEFAULT 'reclamacoes' CHECK (tipo_dado IN ('reclamacoes')),
  ativo boolean NOT NULL DEFAULT true,
  loja_id_default uuid REFERENCES public.config_lojas(id) ON DELETE SET NULL,
  ultima_execucao_at timestamptz,
  total_recebido int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_n8n_endpoints_slug ON public.n8n_webhook_endpoints(slug);
CREATE INDEX idx_n8n_endpoints_ativo ON public.n8n_webhook_endpoints(ativo);

ALTER TABLE public.n8n_webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "n8n_endpoints_admin_all"
  ON public.n8n_webhook_endpoints
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_n8n_endpoints_updated_at
  BEFORE UPDATE ON public.n8n_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela de execuções (log de cada chamada)
CREATE TABLE public.n8n_webhook_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.n8n_webhook_endpoints(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  payload_recebido jsonb,
  linhas_processadas int NOT NULL DEFAULT 0,
  linhas_inseridas int NOT NULL DEFAULT 0,
  linhas_duplicadas int NOT NULL DEFAULT 0,
  linhas_invalidas int NOT NULL DEFAULT 0,
  erros jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_n8n_executions_endpoint ON public.n8n_webhook_executions(endpoint_id, created_at DESC);

ALTER TABLE public.n8n_webhook_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "n8n_executions_admin_read"
  ON public.n8n_webhook_executions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 3. Índice de deduplicação em reclamacoes (idempotência n8n)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reclamacoes_dedupe
  ON public.reclamacoes (loja_id, fonte, data_reclamacao, md5(coalesce(texto_original, '')))
  WHERE fonte <> 'manual';