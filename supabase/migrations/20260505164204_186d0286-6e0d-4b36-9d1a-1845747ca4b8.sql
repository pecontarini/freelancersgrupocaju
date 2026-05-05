
-- ============================================================
-- A1: sheets_blocks_snapshot — armazena blocos estruturados
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sheets_blocks_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sheets_sources(id) ON DELETE CASCADE,
  meta_key text NOT NULL,
  block_key text NOT NULL,
  block_type text NOT NULL,
  mes_ref text NOT NULL,
  loja_codigo text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sheets_blocks_unique_idx
  ON public.sheets_blocks_snapshot(meta_key, mes_ref, block_key, COALESCE(loja_codigo, ''));

CREATE INDEX IF NOT EXISTS sheets_blocks_meta_mes_idx
  ON public.sheets_blocks_snapshot(meta_key, mes_ref);

CREATE INDEX IF NOT EXISTS sheets_blocks_source_idx
  ON public.sheets_blocks_snapshot(source_id);

ALTER TABLE public.sheets_blocks_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sheets_blocks"
  ON public.sheets_blocks_snapshot FOR SELECT
  TO authenticated USING (true);

CREATE TRIGGER trg_sheets_blocks_updated
  BEFORE UPDATE ON public.sheets_blocks_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- B1: reclamacoes_config — singleton para o toggle de coleta
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reclamacoes_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  source_id uuid REFERENCES public.sheets_sources(id) ON DELETE SET NULL,
  classificador_ai boolean NOT NULL DEFAULT false,
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.reclamacoes_config (enabled, classificador_ai, singleton)
  VALUES (false, false, true)
  ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.reclamacoes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read reclamacoes_config"
  ON public.reclamacoes_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage reclamacoes_config"
  ON public.reclamacoes_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_reclamacoes_config_updated
  BEFORE UPDATE ON public.reclamacoes_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- B1: reclamacoes_comentarios — feedback estruturado
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reclamacoes_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sheets_sources(id) ON DELETE SET NULL,
  loja_codigo text,
  loja_id uuid,
  canal text,
  nota numeric,
  data_comentario date,
  autor text,
  comentario text NOT NULL,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'novo',
  action_plan_id uuid,
  source_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reclamacoes_comentarios_loja_idx
  ON public.reclamacoes_comentarios(loja_codigo, data_comentario DESC);
CREATE INDEX IF NOT EXISTS reclamacoes_comentarios_status_idx
  ON public.reclamacoes_comentarios(status);

ALTER TABLE public.reclamacoes_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read reclamacoes"
  ON public.reclamacoes_comentarios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/operator manage reclamacoes"
  ON public.reclamacoes_comentarios FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'operator'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'operator'::public.app_role)
  );

CREATE TRIGGER trg_reclamacoes_comentarios_updated
  BEFORE UPDATE ON public.reclamacoes_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
