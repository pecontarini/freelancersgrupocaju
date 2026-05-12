ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS deprecated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deprecated_reason text,
  ADD COLUMN IF NOT EXISTS canonical_template_id uuid REFERENCES public.checklist_templates(id);

UPDATE public.checklist_templates AS t
   SET is_active = false,
       deprecated_at = now(),
       deprecated_reason = 'Substituído por template canônico expandido (Sprint 0)',
       canonical_template_id = c.id
  FROM public.checklist_templates AS c
 WHERE t.name = 'Checklist - Antonio'
   AND c.name = 'Fiscal de Back - Antonio';

UPDATE public.checklist_templates AS t
   SET is_active = false,
       deprecated_at = now(),
       deprecated_reason = 'Substituído por template canônico expandido (Sprint 0)',
       canonical_template_id = c.id
  FROM public.checklist_templates AS c
 WHERE t.name = 'Checklist - Bruno'
   AND c.name = 'Supervisão de Front - Bruno';

UPDATE public.checklist_templates AS t
   SET is_active = false,
       deprecated_at = now(),
       deprecated_reason = 'Variante regional consolidada no canônico Bruno (Sprint 0)',
       canonical_template_id = c.id
  FROM public.checklist_templates AS c
 WHERE t.name = 'NFE 03 - NAZO AGUAS CLARAS - 186984468-nazo-sushi-bar-aguas-claras-01-03-2026'
   AND c.name = 'Supervisão de Front - Bruno';

DO $verify$
DECLARE
  v_deprecated int;
  v_canonical_set int;
BEGIN
  SELECT COUNT(*) INTO v_deprecated
    FROM public.checklist_templates
   WHERE deprecated_at IS NOT NULL;

  SELECT COUNT(*) INTO v_canonical_set
    FROM public.checklist_templates
   WHERE deprecated_at IS NOT NULL
     AND canonical_template_id IS NOT NULL;

  IF v_deprecated <> 3 THEN
    RAISE EXCEPTION 'sprint0_04: esperado 3 templates deprecados, encontrado %', v_deprecated;
  END IF;
  IF v_canonical_set <> 3 THEN
    RAISE EXCEPTION 'sprint0_04: % deprecados sem canonical_template_id', v_deprecated - v_canonical_set;
  END IF;

  RAISE NOTICE 'sprint0_04 OK: 3 deprecados, todos com canonical_template_id';
END
$verify$;