
-- 1. checklist_templates
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id),
  name text NOT NULL,
  source_pdf_url text,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access checklist_templates" ON public.checklist_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers view own store templates" ON public.checklist_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gerente_unidade') AND public.user_has_access_to_loja(auth.uid(), loja_id));

-- 2. checklist_template_items
CREATE TABLE public.checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  item_text text NOT NULL,
  item_order integer NOT NULL DEFAULT 0,
  weight numeric NOT NULL DEFAULT 1,
  sector_code text,
  original_category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access checklist_template_items" ON public.checklist_template_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers view own store template items" ON public.checklist_template_items
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerente_unidade') AND
    EXISTS (
      SELECT 1 FROM public.checklist_templates ct
      WHERE ct.id = template_id AND public.user_has_access_to_loja(auth.uid(), ct.loja_id)
    )
  );

-- 3. checklist_sector_links
CREATE TABLE public.checklist_sector_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id),
  sector_code text NOT NULL,
  access_token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_sector_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access checklist_sector_links" ON public.checklist_sector_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers view own store links" ON public.checklist_sector_links
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gerente_unidade') AND public.user_has_access_to_loja(auth.uid(), loja_id));

-- 4. checklist_responses
CREATE TABLE public.checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.checklist_sector_links(id),
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id),
  sector_code text NOT NULL,
  response_date date NOT NULL DEFAULT CURRENT_DATE,
  total_score numeric NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  conforming_items integer NOT NULL DEFAULT 0,
  responded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access checklist_responses" ON public.checklist_responses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers view own store responses" ON public.checklist_responses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gerente_unidade') AND public.user_has_access_to_loja(auth.uid(), loja_id));

-- 5. checklist_response_items
CREATE TABLE public.checklist_response_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.checklist_responses(id) ON DELETE CASCADE,
  template_item_id uuid NOT NULL REFERENCES public.checklist_template_items(id),
  is_conforming boolean NOT NULL DEFAULT true,
  observation text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_response_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access checklist_response_items" ON public.checklist_response_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers view own store response items" ON public.checklist_response_items
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerente_unidade') AND
    EXISTS (
      SELECT 1 FROM public.checklist_responses cr
      WHERE cr.id = response_id AND public.user_has_access_to_loja(auth.uid(), cr.loja_id)
    )
  );

-- Indexes
CREATE INDEX idx_checklist_templates_loja ON public.checklist_templates(loja_id);
CREATE INDEX idx_checklist_template_items_template ON public.checklist_template_items(template_id);
CREATE INDEX idx_checklist_template_items_sector ON public.checklist_template_items(sector_code);
CREATE INDEX idx_checklist_sector_links_token ON public.checklist_sector_links(access_token);
CREATE INDEX idx_checklist_sector_links_loja ON public.checklist_sector_links(loja_id);
CREATE INDEX idx_checklist_responses_loja_date ON public.checklist_responses(loja_id, response_date);
CREATE INDEX idx_checklist_responses_link ON public.checklist_responses(link_id);
CREATE INDEX idx_checklist_response_items_response ON public.checklist_response_items(response_id);

-- Storage bucket for checklist photos
INSERT INTO storage.buckets (id, name, public) VALUES ('checklist-photos', 'checklist-photos', true);

CREATE POLICY "Anyone can upload checklist photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'checklist-photos');

CREATE POLICY "Anyone can view checklist photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'checklist-photos');
