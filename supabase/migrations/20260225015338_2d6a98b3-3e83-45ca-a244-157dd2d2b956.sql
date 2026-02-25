
-- Allow operators to manage store_budgets for their assigned stores
CREATE POLICY "Operators can manage their store budgets"
ON public.store_budgets
FOR ALL
USING (has_role(auth.uid(), 'operator'::app_role) AND user_has_access_to_loja(auth.uid(), store_id))
WITH CHECK (has_role(auth.uid(), 'operator'::app_role) AND user_has_access_to_loja(auth.uid(), store_id));
