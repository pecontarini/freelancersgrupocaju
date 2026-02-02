-- Drop the existing restrictive policy for cmv_price_history inserts
DROP POLICY IF EXISTS "Only admins can manage cmv_price_history" ON public.cmv_price_history;

-- Create policy allowing admins full management
CREATE POLICY "Admins can manage cmv_price_history"
ON public.cmv_price_history
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create policy allowing store managers to INSERT price history records
-- This is needed when they process NFe entries and prices change
CREATE POLICY "Store managers can insert cmv_price_history"
ON public.cmv_price_history
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente_unidade'::app_role)
);