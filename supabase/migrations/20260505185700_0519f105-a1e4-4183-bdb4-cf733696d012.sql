CREATE TABLE public.indicadores_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_key text NOT NULL,
  referencia_mes text NOT NULL,
  referencia_label text NOT NULL,
  dados jsonb NOT NULL,
  arquivo_nome text,
  linhas_importadas integer DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meta_key, referencia_mes)
);

CREATE INDEX idx_indicadores_snapshots_meta ON public.indicadores_snapshots(meta_key, referencia_mes DESC);

ALTER TABLE public.indicadores_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_indicadores_snapshots" ON public.indicadores_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_indicadores_snapshots" ON public.indicadores_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_indicadores_snapshots" ON public.indicadores_snapshots
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "delete_indicadores_snapshots" ON public.indicadores_snapshots
  FOR DELETE TO authenticated USING (true);