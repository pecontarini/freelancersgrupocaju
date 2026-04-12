
ALTER TABLE public.config_lojas ADD COLUMN pin_contagem varchar(4);

-- Allow public read of pin for validation on public counting page
CREATE POLICY "Anyone can read loja pin_contagem"
ON public.config_lojas
FOR SELECT
USING (true);

-- Allow admins/operators/gerentes to update pin
CREATE POLICY "Admins and managers can update loja pin"
ON public.config_lojas
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'operator')
  OR public.has_role(auth.uid(), 'gerente_unidade')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'operator')
  OR public.has_role(auth.uid(), 'gerente_unidade')
);
