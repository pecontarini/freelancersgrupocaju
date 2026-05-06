
-- 1) turno_config
CREATE TABLE public.turno_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  setor TEXT NOT NULL,
  tipo_turno TEXT NOT NULL CHECK (tipo_turno IN ('ABRIDOR','FECHADOR','INTERMEDIARIO','ALMOCO','EXTRA')),
  dia_tipo TEXT NOT NULL CHECK (dia_tipo IN ('SEMANA','FDS','DOM')),
  entrada_1 TIME NOT NULL,
  saida_1 TIME NOT NULL,
  cruza_meia_noite_1 BOOLEAN NOT NULL DEFAULT false,
  entrada_2 TIME,
  saida_2 TIME,
  cruza_meia_noite_2 BOOLEAN NOT NULL DEFAULT false,
  gap_min INTEGER NOT NULL DEFAULT 180,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, setor, tipo_turno, dia_tipo)
);

-- 2) escala_minima
CREATE TABLE public.escala_minima (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  setor TEXT NOT NULL,
  dia_semana TEXT NOT NULL CHECK (dia_semana IN ('SEG','TER','QUA','QUI','SEX','SAB','DOM')),
  turno TEXT NOT NULL CHECK (turno IN ('ALMOCO','JANTAR')),
  qtd_efetivos INTEGER NOT NULL DEFAULT 0,
  qtd_extras INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, setor, dia_semana, turno)
);

-- 3) escala_template
CREATE TABLE public.escala_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  setor TEXT NOT NULL,
  semana_inicio DATE NOT NULL,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','pendente_aprovacao','aprovado','rejeitado')),
  comentario_rejeicao TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unidade_id, setor, semana_inicio)
);

-- 4) escala_vinculacao
CREATE TABLE public.escala_vinculacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.escala_template(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL,
  dia_semana TEXT NOT NULL CHECK (dia_semana IN ('SEG','TER','QUA','QUI','SEX','SAB','DOM')),
  tipo_turno TEXT NOT NULL,
  tipo_dia TEXT NOT NULL CHECK (tipo_dia IN ('SEMANA','FDS','DOM')),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, funcionario_id, dia_semana)
);

-- Indexes
CREATE INDEX idx_turno_config_unit ON public.turno_config(unidade_id, setor);
CREATE INDEX idx_escala_minima_unit ON public.escala_minima(unidade_id, setor);
CREATE INDEX idx_escala_template_unit ON public.escala_template(unidade_id, setor, semana_inicio);
CREATE INDEX idx_escala_vinculacao_template ON public.escala_vinculacao(template_id);
CREATE INDEX idx_escala_vinculacao_func ON public.escala_vinculacao(funcionario_id);

-- updated_at triggers
CREATE TRIGGER trg_turno_config_updated BEFORE UPDATE ON public.turno_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_escala_minima_updated BEFORE UPDATE ON public.escala_minima
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_escala_template_updated BEFORE UPDATE ON public.escala_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.turno_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_minima ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_vinculacao ENABLE ROW LEVEL SECURITY;

-- turno_config policies
CREATE POLICY "turno_config_admin_all" ON public.turno_config FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operator'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operator'));
CREATE POLICY "turno_config_unit_access" ON public.turno_config FOR ALL
  USING (user_has_access_to_loja(auth.uid(), unidade_id))
  WITH CHECK (user_has_access_to_loja(auth.uid(), unidade_id));

-- escala_minima policies
CREATE POLICY "escala_minima_admin_all" ON public.escala_minima FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operator'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operator'));
CREATE POLICY "escala_minima_unit_access" ON public.escala_minima FOR ALL
  USING (user_has_access_to_loja(auth.uid(), unidade_id))
  WITH CHECK (user_has_access_to_loja(auth.uid(), unidade_id));

-- escala_template policies
CREATE POLICY "escala_template_admin_all" ON public.escala_template FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operator'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operator'));
CREATE POLICY "escala_template_unit_access" ON public.escala_template FOR ALL
  USING (user_has_access_to_loja(auth.uid(), unidade_id))
  WITH CHECK (user_has_access_to_loja(auth.uid(), unidade_id));

-- escala_vinculacao policies (via template)
CREATE POLICY "escala_vinculacao_admin_all" ON public.escala_vinculacao FOR ALL
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operator'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operator'));
CREATE POLICY "escala_vinculacao_unit_access" ON public.escala_vinculacao FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.escala_template t
    WHERE t.id = escala_vinculacao.template_id
      AND user_has_access_to_loja(auth.uid(), t.unidade_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.escala_template t
    WHERE t.id = escala_vinculacao.template_id
      AND user_has_access_to_loja(auth.uid(), t.unidade_id)
  ));
