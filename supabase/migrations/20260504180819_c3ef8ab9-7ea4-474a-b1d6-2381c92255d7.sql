
-- Create metas_snapshot table
CREATE TABLE public.metas_snapshot (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_codigo TEXT NOT NULL,
  loja_id UUID REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  mes_ref TEXT NOT NULL, -- 'YYYY-MM'
  nps NUMERIC,
  nps_anterior NUMERIC,
  cmv_salmao NUMERIC,
  cmv_salmao_anterior NUMERIC,
  cmv_carnes NUMERIC,
  cmv_carnes_anterior NUMERIC,
  kds NUMERIC,
  kds_anterior NUMERIC,
  conformidade NUMERIC,
  conformidade_anterior NUMERIC,
  red_flag BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT metas_snapshot_unique_loja_mes UNIQUE (loja_codigo, mes_ref)
);

CREATE INDEX idx_metas_snapshot_mes_ref ON public.metas_snapshot(mes_ref);
CREATE INDEX idx_metas_snapshot_loja_codigo ON public.metas_snapshot(loja_codigo);
CREATE INDEX idx_metas_snapshot_loja_id ON public.metas_snapshot(loja_id);

-- Trigger for updated_at
CREATE TRIGGER update_metas_snapshot_updated_at
BEFORE UPDATE ON public.metas_snapshot
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.metas_snapshot ENABLE ROW LEVEL SECURITY;

-- Admin / operator: full access
CREATE POLICY "Admins and operators full access metas_snapshot"
ON public.metas_snapshot
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- Gerente unidade: read-only para suas lojas
CREATE POLICY "Gerente unidade reads own loja metas_snapshot"
ON public.metas_snapshot
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND loja_id IS NOT NULL
  AND public.user_has_access_to_loja(auth.uid(), loja_id)
);

-- Enable realtime
ALTER TABLE public.metas_snapshot REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.metas_snapshot;
