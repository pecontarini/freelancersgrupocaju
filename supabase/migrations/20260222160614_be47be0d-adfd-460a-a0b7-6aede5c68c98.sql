
-- 1. Add template_id to checklist_sector_links
ALTER TABLE public.checklist_sector_links 
ADD COLUMN template_id uuid REFERENCES public.checklist_templates(id) ON DELETE CASCADE;

-- 2. Add template_id to checklist_responses
ALTER TABLE public.checklist_responses 
ADD COLUMN template_id uuid REFERENCES public.checklist_templates(id);

-- 3. Backfill existing links: try to match template by loja_id
UPDATE public.checklist_sector_links csl
SET template_id = (
  SELECT ct.id FROM public.checklist_templates ct 
  WHERE ct.loja_id = csl.loja_id AND ct.is_active = true 
  ORDER BY ct.created_at DESC LIMIT 1
)
WHERE csl.template_id IS NULL;

-- 4. Backfill existing responses
UPDATE public.checklist_responses cr
SET template_id = (
  SELECT csl.template_id FROM public.checklist_sector_links csl
  WHERE csl.id = cr.link_id
)
WHERE cr.template_id IS NULL;

-- 5. RLS policies for gerente_unidade on checklist_templates
CREATE POLICY "gerente_unidade can select own store templates"
ON public.checklist_templates FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND public.user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "gerente_unidade can insert own store templates"
ON public.checklist_templates FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND public.user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "gerente_unidade can update own store templates"
ON public.checklist_templates FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND public.user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "gerente_unidade can delete own store templates"
ON public.checklist_templates FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND public.user_has_access_to_loja(auth.uid(), loja_id)
);

-- 6. RLS policies for gerente_unidade on checklist_template_items
CREATE POLICY "gerente_unidade can select own store template items"
ON public.checklist_template_items FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND EXISTS (
    SELECT 1 FROM public.checklist_templates ct
    WHERE ct.id = template_id
    AND public.user_has_access_to_loja(auth.uid(), ct.loja_id)
  )
);

CREATE POLICY "gerente_unidade can insert own store template items"
ON public.checklist_template_items FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND EXISTS (
    SELECT 1 FROM public.checklist_templates ct
    WHERE ct.id = template_id
    AND public.user_has_access_to_loja(auth.uid(), ct.loja_id)
  )
);

CREATE POLICY "gerente_unidade can update own store template items"
ON public.checklist_template_items FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND EXISTS (
    SELECT 1 FROM public.checklist_templates ct
    WHERE ct.id = template_id
    AND public.user_has_access_to_loja(auth.uid(), ct.loja_id)
  )
);

CREATE POLICY "gerente_unidade can delete own store template items"
ON public.checklist_template_items FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND EXISTS (
    SELECT 1 FROM public.checklist_templates ct
    WHERE ct.id = template_id
    AND public.user_has_access_to_loja(auth.uid(), ct.loja_id)
  )
);

-- 7. RLS policies for gerente_unidade on checklist_sector_links
CREATE POLICY "gerente_unidade can manage own store links"
ON public.checklist_sector_links FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND public.user_has_access_to_loja(auth.uid(), loja_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND public.user_has_access_to_loja(auth.uid(), loja_id)
);

-- 8. RLS policies for gerente_unidade on checklist_responses (read-only)
CREATE POLICY "gerente_unidade can view own store responses"
ON public.checklist_responses FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND public.user_has_access_to_loja(auth.uid(), loja_id)
);

-- 9. RLS on checklist_response_items for gerente_unidade
CREATE POLICY "gerente_unidade can view own store response items"
ON public.checklist_response_items FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente_unidade')
  AND EXISTS (
    SELECT 1 FROM public.checklist_responses cr
    WHERE cr.id = response_id
    AND public.user_has_access_to_loja(auth.uid(), cr.loja_id)
  )
);

-- 10. Add unique constraint to prevent duplicate links per template+sector
CREATE UNIQUE INDEX idx_checklist_sector_links_unique_template 
ON public.checklist_sector_links (loja_id, sector_code, template_id) 
WHERE template_id IS NOT NULL;
