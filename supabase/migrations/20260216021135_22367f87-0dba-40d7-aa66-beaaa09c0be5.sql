
-- 1. job_titles: drop existing admin policy and recreate + add store users
DROP POLICY IF EXISTS "Admins can manage job_titles" ON public.job_titles;

CREATE POLICY "Admins can manage job_titles"
ON public.job_titles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store users can manage job_titles"
ON public.job_titles
FOR ALL
USING (user_has_access_to_loja(auth.uid(), unit_id))
WITH CHECK (user_has_access_to_loja(auth.uid(), unit_id));

-- 2. employees: chefe_setor ALL
DROP POLICY IF EXISTS "Chefe setor can view unit employees" ON public.employees;

CREATE POLICY "Chefe setor can manage unit employees"
ON public.employees
FOR ALL
USING (
  has_role(auth.uid(), 'chefe_setor'::app_role) 
  AND EXISTS (
    SELECT 1 FROM user_stores us 
    WHERE us.user_id = auth.uid() AND us.loja_id = employees.unit_id
  )
)
WITH CHECK (
  has_role(auth.uid(), 'chefe_setor'::app_role) 
  AND EXISTS (
    SELECT 1 FROM user_stores us 
    WHERE us.user_id = auth.uid() AND us.loja_id = employees.unit_id
  )
);

-- 3. sectors: open management to store users
DROP POLICY IF EXISTS "Only admins can manage sectors" ON public.sectors;
DROP POLICY IF EXISTS "Admins can manage sectors" ON public.sectors;

CREATE POLICY "Admins can manage sectors"
ON public.sectors
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store users can manage sectors"
ON public.sectors
FOR ALL
USING (user_has_access_to_loja(auth.uid(), unit_id))
WITH CHECK (user_has_access_to_loja(auth.uid(), unit_id));

-- 4. sector_job_titles: open to store users
DROP POLICY IF EXISTS "Only admins can manage sector_job_titles" ON public.sector_job_titles;
DROP POLICY IF EXISTS "Admins can manage sector_job_titles" ON public.sector_job_titles;

CREATE POLICY "Admins can manage sector_job_titles"
ON public.sector_job_titles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store users can manage sector_job_titles"
ON public.sector_job_titles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM sectors s 
    JOIN user_stores us ON us.loja_id = s.unit_id
    WHERE s.id = sector_job_titles.sector_id AND us.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sectors s 
    JOIN user_stores us ON us.loja_id = s.unit_id
    WHERE s.id = sector_job_titles.sector_id AND us.user_id = auth.uid()
  )
);

-- 5. staffing_matrix: add chefe_setor
DROP POLICY IF EXISTS "Chefe setor can manage staffing_matrix" ON public.staffing_matrix;

CREATE POLICY "Chefe setor can manage staffing_matrix"
ON public.staffing_matrix
FOR ALL
USING (
  has_role(auth.uid(), 'chefe_setor'::app_role)
  AND EXISTS (
    SELECT 1 FROM sectors s
    JOIN user_stores us ON us.loja_id = s.unit_id
    WHERE s.id = staffing_matrix.sector_id AND us.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'chefe_setor'::app_role)
  AND EXISTS (
    SELECT 1 FROM sectors s
    JOIN user_stores us ON us.loja_id = s.unit_id
    WHERE s.id = staffing_matrix.sector_id AND us.user_id = auth.uid()
  )
);
