-- Allow chefe_setor to view schedules for their units
CREATE POLICY "Chefe setor can view unit schedules"
ON public.schedules
FOR SELECT
USING (
  has_role(auth.uid(), 'chefe_setor'::app_role)
  AND EXISTS (
    SELECT 1 FROM user_stores us WHERE us.user_id = auth.uid() AND us.loja_id = (
      SELECT s.unit_id FROM sectors s WHERE s.id = schedules.sector_id
    )
  )
);

-- Allow chefe_setor to manage schedules for their units  
CREATE POLICY "Chefe setor can manage unit schedules"
ON public.schedules
FOR ALL
USING (
  has_role(auth.uid(), 'chefe_setor'::app_role)
  AND EXISTS (
    SELECT 1 FROM user_stores us WHERE us.user_id = auth.uid() AND us.loja_id = (
      SELECT s.unit_id FROM sectors s WHERE s.id = schedules.sector_id
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'chefe_setor'::app_role)
  AND EXISTS (
    SELECT 1 FROM user_stores us WHERE us.user_id = auth.uid() AND us.loja_id = (
      SELECT s.unit_id FROM sectors s WHERE s.id = schedules.sector_id
    )
  )
);

-- Allow chefe_setor to view employees of their units
CREATE POLICY "Chefe setor can view unit employees"
ON public.employees
FOR SELECT
USING (
  has_role(auth.uid(), 'chefe_setor'::app_role)
  AND EXISTS (
    SELECT 1 FROM user_stores us WHERE us.user_id = auth.uid() AND us.loja_id = employees.unit_id
  )
);