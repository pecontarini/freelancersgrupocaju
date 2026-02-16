
-- Table to store NFe item name → CMV item auto-mappings
CREATE TABLE public.cmv_nfe_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_nfe_normalizado text NOT NULL UNIQUE,
  nome_nfe_original text NOT NULL,
  cmv_item_id uuid NOT NULL REFERENCES public.cmv_items(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cmv_nfe_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view cmv_nfe_mappings"
  ON public.cmv_nfe_mappings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage cmv_nfe_mappings"
  ON public.cmv_nfe_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Also allow gerente_unidade and partner to insert/manage
CREATE POLICY "Store managers can manage cmv_nfe_mappings"
  ON public.cmv_nfe_mappings FOR ALL
  USING (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'partner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'partner'::app_role));
