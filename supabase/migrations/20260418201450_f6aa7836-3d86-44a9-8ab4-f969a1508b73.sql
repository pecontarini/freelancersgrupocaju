
-- Allow operators to manage praças of stores they have access to
CREATE POLICY "Operators manage pracas of their stores"
ON public.pracas_plano_chao
FOR ALL
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND user_has_access_to_loja(auth.uid(), unit_id)
)
WITH CHECK (
  has_role(auth.uid(), 'operator'::app_role)
  AND user_has_access_to_loja(auth.uid(), unit_id)
);

-- Unique constraint to safely upsert by (unit, sector, name, shift, day)
CREATE UNIQUE INDEX IF NOT EXISTS pracas_plano_chao_unique_key
ON public.pracas_plano_chao (unit_id, setor, nome_praca, turno, dia_semana);
