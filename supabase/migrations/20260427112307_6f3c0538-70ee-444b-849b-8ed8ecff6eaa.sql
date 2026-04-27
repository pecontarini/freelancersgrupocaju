
-- =====================================================
-- AGENDA DO LÍDER — estrutura de Missões colaborativas
-- =====================================================

-- 1) ENUMS
DO $$ BEGIN
  CREATE TYPE public.missao_status AS ENUM ('a_fazer', 'em_andamento', 'aguardando', 'concluido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.missao_prioridade AS ENUM ('alta', 'media', 'baixa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.missao_papel AS ENUM ('responsavel', 'co_responsavel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.missao_chat_role AS ENUM ('user', 'assistant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) TABELA MISSOES
CREATE TABLE IF NOT EXISTS public.missoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  status public.missao_status NOT NULL DEFAULT 'a_fazer',
  prioridade public.missao_prioridade NOT NULL DEFAULT 'media',
  unidade_id UUID REFERENCES public.config_lojas(id) ON DELETE SET NULL,
  criado_por UUID NOT NULL,
  prazo DATE,
  semana_referencia DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missoes_unidade ON public.missoes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_missoes_criado_por ON public.missoes(criado_por);
CREATE INDEX IF NOT EXISTS idx_missoes_status ON public.missoes(status);
CREATE INDEX IF NOT EXISTS idx_missoes_semana ON public.missoes(semana_referencia);

ALTER TABLE public.missoes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_missoes_updated_at
  BEFORE UPDATE ON public.missoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) TABELA MISSAO_MEMBROS
CREATE TABLE IF NOT EXISTS public.missao_membros (
  missao_id UUID NOT NULL REFERENCES public.missoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  papel public.missao_papel NOT NULL DEFAULT 'co_responsavel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (missao_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_missao_responsavel
  ON public.missao_membros(missao_id) WHERE papel = 'responsavel';
CREATE INDEX IF NOT EXISTS idx_missao_membros_user ON public.missao_membros(user_id);

ALTER TABLE public.missao_membros ENABLE ROW LEVEL SECURITY;

-- 4) FUNÇÃO HELPER: usuário é membro da missão?
CREATE OR REPLACE FUNCTION public.is_missao_member(_missao_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missao_membros
    WHERE missao_id = _missao_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_missao_creator(_missao_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missoes
    WHERE id = _missao_id AND criado_por = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_missao(_missao_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'operator'::app_role)
    OR public.is_missao_creator(_missao_id, _user_id)
    OR public.is_missao_member(_missao_id, _user_id)
    OR EXISTS (
      SELECT 1 FROM public.missoes m
      WHERE m.id = _missao_id
        AND m.unidade_id IS NOT NULL
        AND public.has_role(_user_id, 'gerente_unidade'::app_role)
        AND public.user_has_access_to_loja(_user_id, m.unidade_id)
    );
$$;

-- 5) RLS POLICIES — MISSOES
DROP POLICY IF EXISTS "missoes_select" ON public.missoes;
CREATE POLICY "missoes_select" ON public.missoes
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR criado_por = auth.uid()
    OR is_missao_member(id, auth.uid())
    OR (
      unidade_id IS NOT NULL
      AND has_role(auth.uid(), 'gerente_unidade'::app_role)
      AND user_has_access_to_loja(auth.uid(), unidade_id)
    )
  );

DROP POLICY IF EXISTS "missoes_insert" ON public.missoes;
CREATE POLICY "missoes_insert" ON public.missoes
  FOR INSERT
  WITH CHECK (
    auth.uid() = criado_por
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'operator'::app_role)
      OR has_role(auth.uid(), 'gerente_unidade'::app_role)
      OR has_role(auth.uid(), 'chefe_setor'::app_role)
    )
  );

DROP POLICY IF EXISTS "missoes_update" ON public.missoes;
CREATE POLICY "missoes_update" ON public.missoes
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR criado_por = auth.uid()
    OR is_missao_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "missoes_delete" ON public.missoes;
CREATE POLICY "missoes_delete" ON public.missoes
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR criado_por = auth.uid()
  );

-- 6) RLS POLICIES — MISSAO_MEMBROS
DROP POLICY IF EXISTS "missao_membros_select" ON public.missao_membros;
CREATE POLICY "missao_membros_select" ON public.missao_membros
  FOR SELECT
  USING (user_can_see_missao(missao_id, auth.uid()));

DROP POLICY IF EXISTS "missao_membros_insert" ON public.missao_membros;
CREATE POLICY "missao_membros_insert" ON public.missao_membros
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR is_missao_creator(missao_id, auth.uid())
  );

DROP POLICY IF EXISTS "missao_membros_delete" ON public.missao_membros;
CREATE POLICY "missao_membros_delete" ON public.missao_membros
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR is_missao_creator(missao_id, auth.uid())
  );

-- 7) TABELA MISSAO_TAREFAS
CREATE TABLE IF NOT EXISTS public.missao_tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  missao_id UUID NOT NULL REFERENCES public.missoes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  dia_semana DATE,
  ordem INTEGER NOT NULL DEFAULT 0,
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_por UUID,
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missao_tarefas_missao ON public.missao_tarefas(missao_id);
CREATE INDEX IF NOT EXISTS idx_missao_tarefas_dia ON public.missao_tarefas(dia_semana);

ALTER TABLE public.missao_tarefas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_missao_tarefas_updated_at
  BEFORE UPDATE ON public.missao_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "missao_tarefas_select" ON public.missao_tarefas;
CREATE POLICY "missao_tarefas_select" ON public.missao_tarefas
  FOR SELECT
  USING (user_can_see_missao(missao_id, auth.uid()));

DROP POLICY IF EXISTS "missao_tarefas_insert" ON public.missao_tarefas;
CREATE POLICY "missao_tarefas_insert" ON public.missao_tarefas
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR is_missao_creator(missao_id, auth.uid())
    OR is_missao_member(missao_id, auth.uid())
  );

DROP POLICY IF EXISTS "missao_tarefas_update" ON public.missao_tarefas;
CREATE POLICY "missao_tarefas_update" ON public.missao_tarefas
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR is_missao_creator(missao_id, auth.uid())
    OR is_missao_member(missao_id, auth.uid())
  );

DROP POLICY IF EXISTS "missao_tarefas_delete" ON public.missao_tarefas;
CREATE POLICY "missao_tarefas_delete" ON public.missao_tarefas
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
    OR is_missao_creator(missao_id, auth.uid())
  );

-- 8) TABELA MISSAO_COMENTARIOS
CREATE TABLE IF NOT EXISTS public.missao_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  missao_id UUID NOT NULL REFERENCES public.missoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missao_comentarios_missao ON public.missao_comentarios(missao_id);

ALTER TABLE public.missao_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "missao_comentarios_select" ON public.missao_comentarios;
CREATE POLICY "missao_comentarios_select" ON public.missao_comentarios
  FOR SELECT
  USING (user_can_see_missao(missao_id, auth.uid()));

DROP POLICY IF EXISTS "missao_comentarios_insert" ON public.missao_comentarios;
CREATE POLICY "missao_comentarios_insert" ON public.missao_comentarios
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_can_see_missao(missao_id, auth.uid())
  );

DROP POLICY IF EXISTS "missao_comentarios_delete" ON public.missao_comentarios;
CREATE POLICY "missao_comentarios_delete" ON public.missao_comentarios
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

-- 9) TABELA MISSAO_ANEXOS
CREATE TABLE IF NOT EXISTS public.missao_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  missao_id UUID NOT NULL REFERENCES public.missoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missao_anexos_missao ON public.missao_anexos(missao_id);

ALTER TABLE public.missao_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "missao_anexos_select" ON public.missao_anexos;
CREATE POLICY "missao_anexos_select" ON public.missao_anexos
  FOR SELECT USING (user_can_see_missao(missao_id, auth.uid()));

DROP POLICY IF EXISTS "missao_anexos_insert" ON public.missao_anexos;
CREATE POLICY "missao_anexos_insert" ON public.missao_anexos
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_can_see_missao(missao_id, auth.uid())
  );

DROP POLICY IF EXISTS "missao_anexos_delete" ON public.missao_anexos;
CREATE POLICY "missao_anexos_delete" ON public.missao_anexos
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  );

-- 10) TABELA MISSAO_CHAT (histórico do chat com IA)
CREATE TABLE IF NOT EXISTS public.missao_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  semana_referencia DATE NOT NULL,
  role public.missao_chat_role NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missao_chat_user_semana
  ON public.missao_chat(user_id, semana_referencia, created_at);

ALTER TABLE public.missao_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "missao_chat_own_select" ON public.missao_chat;
CREATE POLICY "missao_chat_own_select" ON public.missao_chat
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "missao_chat_own_insert" ON public.missao_chat;
CREATE POLICY "missao_chat_own_insert" ON public.missao_chat
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "missao_chat_own_delete" ON public.missao_chat;
CREATE POLICY "missao_chat_own_delete" ON public.missao_chat
  FOR DELETE USING (user_id = auth.uid());

-- 11) STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('missao-anexos', 'missao-anexos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "missao_anexos_storage_select" ON storage.objects;
CREATE POLICY "missao_anexos_storage_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'missao-anexos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'operator'::app_role)
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "missao_anexos_storage_insert" ON storage.objects;
CREATE POLICY "missao_anexos_storage_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'missao-anexos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "missao_anexos_storage_delete" ON storage.objects;
CREATE POLICY "missao_anexos_storage_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'missao-anexos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'operator'::app_role)
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );

-- 12) REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.missoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missao_membros;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missao_tarefas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missao_comentarios;

ALTER TABLE public.missoes REPLICA IDENTITY FULL;
ALTER TABLE public.missao_membros REPLICA IDENTITY FULL;
ALTER TABLE public.missao_tarefas REPLICA IDENTITY FULL;
ALTER TABLE public.missao_comentarios REPLICA IDENTITY FULL;
