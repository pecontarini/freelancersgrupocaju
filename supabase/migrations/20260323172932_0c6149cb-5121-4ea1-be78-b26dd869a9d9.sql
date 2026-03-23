DROP POLICY IF EXISTS "Users can view budget entries for their stores" ON checkin_budget_entries;

CREATE POLICY "Users can view budget entries for their stores"
ON checkin_budget_entries FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR user_has_access_to_loja(auth.uid(), loja_id)
);