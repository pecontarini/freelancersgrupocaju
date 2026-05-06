-- Tabela de tokens públicos de aprovação para escalas IA
CREATE TABLE public.escala_aprovacao_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.escala_template(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  usado_em timestamptz,
  ip_aprovador text,
  decisao text
);

CREATE INDEX idx_escala_aprovacao_links_template ON public.escala_aprovacao_links(template_id);
CREATE INDEX idx_escala_aprovacao_links_token ON public.escala_aprovacao_links(token);

ALTER TABLE public.escala_aprovacao_links ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam tudo
CREATE POLICY "Admins manage approval links"
ON public.escala_aprovacao_links
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Operadores podem criar/ler para suas unidades
CREATE POLICY "Authenticated users can read links of their units"
ON public.escala_aprovacao_links
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.escala_template t
    WHERE t.id = escala_aprovacao_links.template_id
      AND public.user_has_access_to_loja(auth.uid(), t.unidade_id)
  )
);

CREATE POLICY "Authenticated users can create links for their units"
ON public.escala_aprovacao_links
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.escala_template t
    WHERE t.id = template_id
      AND public.user_has_access_to_loja(auth.uid(), t.unidade_id)
  )
);
