-- Habilitar extensions para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enums para import_jobs
DO $$ BEGIN
  CREATE TYPE public.import_origem AS ENUM ('upload_manual', 'cron_sheets', 'api');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.import_destino AS ENUM ('store_performance', 'store_performance_entries', 'reclamacoes', 'misto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.import_status AS ENUM ('extracting', 'preview_ready', 'confirmed', 'error', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela import_jobs
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem public.import_origem NOT NULL,
  tipo_destino public.import_destino,
  file_name text,
  file_mime text,
  source_url text,
  ai_model text,
  ai_confianca numeric,
  preview_data jsonb,
  total_linhas integer NOT NULL DEFAULT 0,
  linhas_validas integer NOT NULL DEFAULT 0,
  lojas_nao_mapeadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  mapeamento_colunas jsonb,
  status public.import_status NOT NULL DEFAULT 'extracting',
  erro text,
  linhas_importadas integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON public.import_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_origem ON public.import_jobs(origem);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_jobs_admin_operator_full" ON public.import_jobs;
CREATE POLICY "import_jobs_admin_operator_full" ON public.import_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

DROP POLICY IF EXISTS "import_jobs_own_select" ON public.import_jobs;
CREATE POLICY "import_jobs_own_select" ON public.import_jobs
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "import_jobs_own_insert" ON public.import_jobs;
CREATE POLICY "import_jobs_own_insert" ON public.import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Adicionar colunas em sheets_sources
ALTER TABLE public.sheets_sources
  ADD COLUMN IF NOT EXISTS sync_diario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_dado public.import_destino NOT NULL DEFAULT 'store_performance_entries',
  ADD COLUMN IF NOT EXISTS ultima_execucao_cron timestamptz;