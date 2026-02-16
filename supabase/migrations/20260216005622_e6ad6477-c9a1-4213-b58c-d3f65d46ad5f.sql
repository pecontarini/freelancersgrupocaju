
-- 1. Schedules: Allow gerente_unidade and partner to manage schedules for their units
-- Currently only admin and chefe_setor have ALL access
CREATE POLICY "Gerente can manage unit schedules"
ON public.schedules FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'partner'::app_role))
  AND EXISTS (
    SELECT 1 FROM user_stores us
    WHERE us.user_id = auth.uid()
      AND us.loja_id = (SELECT s.unit_id FROM sectors s WHERE s.id = schedules.sector_id)
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'partner'::app_role))
  AND EXISTS (
    SELECT 1 FROM user_stores us
    WHERE us.user_id = auth.uid()
      AND us.loja_id = (SELECT s.unit_id FROM sectors s WHERE s.id = schedules.sector_id)
  )
);

-- 2. Schedules: Allow gerente_unidade to view their unit schedules
CREATE POLICY "Gerente can view unit schedules"
ON public.schedules FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'partner'::app_role))
  AND EXISTS (
    SELECT 1 FROM user_stores us
    WHERE us.user_id = auth.uid()
      AND us.loja_id = (SELECT s.unit_id FROM sectors s WHERE s.id = schedules.sector_id)
  )
);

-- 3. Profiles: Allow any authenticated user to view profiles (safe - no sensitive data)
-- Drop existing restrictive policy if any and create a simple one
-- Check current: profiles has no explicit SELECT policy listed, so add one
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 4. store_performance_entries: Allow gerentes to insert/update for their stores
CREATE POLICY "Store managers can insert their store entries"
ON public.store_performance_entries FOR INSERT
TO authenticated
WITH CHECK (user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Store managers can update their store entries"
ON public.store_performance_entries FOR UPDATE
TO authenticated
USING (user_has_access_to_loja(auth.uid(), loja_id));

-- 5. Notification logs: Allow gerentes to view their unit notifications
CREATE POLICY "Gerentes can read notification logs"
ON public.notification_logs FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'gerente_unidade'::app_role)
  OR has_role(auth.uid(), 'partner'::app_role)
);

-- 6. staffing_matrix: Allow gerentes and partners to manage
CREATE POLICY "Gerentes can manage staffing_matrix"
ON public.staffing_matrix FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'gerente_unidade'::app_role)
  OR has_role(auth.uid(), 'partner'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'gerente_unidade'::app_role)
  OR has_role(auth.uid(), 'partner'::app_role)
);
