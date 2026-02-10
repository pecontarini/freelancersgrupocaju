
-- 1. Create job_titles table
CREATE TABLE public.job_titles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, unit_id)
);

ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view job_titles"
  ON public.job_titles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage job_titles"
  ON public.job_titles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerentes can manage job_titles of their units"
  ON public.job_titles FOR ALL
  USING (EXISTS (SELECT 1 FROM user_stores WHERE user_stores.user_id = auth.uid() AND user_stores.loja_id = job_titles.unit_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_stores WHERE user_stores.user_id = auth.uid() AND user_stores.loja_id = job_titles.unit_id));

-- 2. Create sector_job_titles junction table
CREATE TABLE public.sector_job_titles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  job_title_id UUID NOT NULL REFERENCES public.job_titles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sector_id, job_title_id)
);

ALTER TABLE public.sector_job_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sector_job_titles"
  ON public.sector_job_titles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage sector_job_titles"
  ON public.sector_job_titles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerentes can manage sector_job_titles via sector unit"
  ON public.sector_job_titles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM sectors s
    JOIN user_stores us ON us.loja_id = s.unit_id
    WHERE s.id = sector_job_titles.sector_id AND us.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sectors s
    JOIN user_stores us ON us.loja_id = s.unit_id
    WHERE s.id = sector_job_titles.sector_id AND us.user_id = auth.uid()
  ));

-- 3. Add job_title_id FK to employees (keep old job_title column for backward compat)
ALTER TABLE public.employees
  ADD COLUMN job_title_id UUID REFERENCES public.job_titles(id) ON DELETE SET NULL;

-- 4. Migrate existing free-text job_title data into job_titles table
INSERT INTO public.job_titles (name, unit_id)
SELECT DISTINCT e.job_title, e.unit_id
FROM public.employees e
WHERE e.job_title IS NOT NULL AND e.job_title != ''
ON CONFLICT (name, unit_id) DO NOTHING;

-- 5. Backfill job_title_id on employees
UPDATE public.employees e
SET job_title_id = jt.id
FROM public.job_titles jt
WHERE jt.name = e.job_title AND jt.unit_id = e.unit_id;
