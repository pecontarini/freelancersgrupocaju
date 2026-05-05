
ALTER TABLE public.sheets_sources
  ADD COLUMN IF NOT EXISTS ultimo_status text DEFAULT 'pendente' CHECK (ultimo_status IN ('ok','erro','pendente')),
  ADD COLUMN IF NOT EXISTS ultimo_erro text;

CREATE TABLE IF NOT EXISTS public.planos_acao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id uuid REFERENCES public.reclamacoes_comentarios(id) ON DELETE CASCADE,
  texto_acao text NOT NULL,
  responsavel text,
  data_criacao timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'aberto'
);

ALTER TABLE public.planos_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_planos" ON public.planos_acao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_planos" ON public.planos_acao
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "update_planos" ON public.planos_acao
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));
