
-- Create checklist_corrections table
CREATE TABLE public.checklist_corrections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  response_item_id uuid NOT NULL REFERENCES public.checklist_response_items(id) ON DELETE CASCADE,
  response_id uuid NOT NULL REFERENCES public.checklist_responses(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id),
  corrected_by_name text NOT NULL,
  correction_photo_url text NOT NULL,
  correction_note text,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (public access via edge function with service_role)
ALTER TABLE public.checklist_corrections ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admins/managers) to view corrections
CREATE POLICY "Admins full access checklist_corrections"
ON public.checklist_corrections
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Managers view own store corrections"
ON public.checklist_corrections
FOR SELECT
USING (has_role(auth.uid(), 'gerente_unidade'::app_role) AND user_has_access_to_loja(auth.uid(), loja_id));

-- Index for lookups
CREATE INDEX idx_checklist_corrections_response_id ON public.checklist_corrections(response_id);
CREATE INDEX idx_checklist_corrections_response_item_id ON public.checklist_corrections(response_item_id);
