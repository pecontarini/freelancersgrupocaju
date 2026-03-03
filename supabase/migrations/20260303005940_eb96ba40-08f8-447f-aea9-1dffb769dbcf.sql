-- Add INSERT policy for gerente_unidade on store_budgets
CREATE POLICY "Managers can insert their store budgets"
ON public.store_budgets
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'gerente_unidade'::app_role) 
  AND user_has_access_to_loja(auth.uid(), store_id)
);

-- Add UPDATE policy for gerente_unidade on store_budgets
CREATE POLICY "Managers can update their store budgets"
ON public.store_budgets
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'gerente_unidade'::app_role) 
  AND user_has_access_to_loja(auth.uid(), store_id)
)
WITH CHECK (
  has_role(auth.uid(), 'gerente_unidade'::app_role) 
  AND user_has_access_to_loja(auth.uid(), store_id)
);