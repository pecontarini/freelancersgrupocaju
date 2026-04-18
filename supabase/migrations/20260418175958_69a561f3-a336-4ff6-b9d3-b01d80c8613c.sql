-- Tabela de vínculo entre unidades (lojas casadas)
CREATE TABLE public.unit_partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  partner_unit_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT unit_partnerships_unique UNIQUE (unit_id, partner_unit_id),
  CONSTRAINT unit_partnerships_no_self CHECK (unit_id <> partner_unit_id)
);

-- Cada loja pode ter no máximo 1 parceira
CREATE UNIQUE INDEX unit_partnerships_unit_idx ON public.unit_partnerships(unit_id);
CREATE UNIQUE INDEX unit_partnerships_partner_idx ON public.unit_partnerships(partner_unit_id);

ALTER TABLE public.unit_partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view unit partnerships"
ON public.unit_partnerships
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and operators can insert unit partnerships"
ON public.unit_partnerships
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins and operators can delete unit partnerships"
ON public.unit_partnerships
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));