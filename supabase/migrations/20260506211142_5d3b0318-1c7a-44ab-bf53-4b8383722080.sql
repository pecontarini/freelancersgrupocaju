CREATE TABLE IF NOT EXISTS public.ai_draft_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  sector_id uuid NOT NULL,
  week_start date NOT NULL,
  label text NOT NULL,
  tipo text NOT NULL,
  responsavel boolean NOT NULL DEFAULT false,
  days jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_draft_slots_lookup
  ON public.ai_draft_slots (unit_id, sector_id, week_start);

ALTER TABLE public.ai_draft_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_draft_slots_select"
  ON public.ai_draft_slots FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operator')
    OR public.user_has_access_to_loja(auth.uid(), unit_id)
  );

CREATE POLICY "ai_draft_slots_insert"
  ON public.ai_draft_slots FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operator')
    OR public.user_has_access_to_loja(auth.uid(), unit_id)
  );

CREATE POLICY "ai_draft_slots_update"
  ON public.ai_draft_slots FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operator')
    OR public.user_has_access_to_loja(auth.uid(), unit_id)
  );

CREATE POLICY "ai_draft_slots_delete"
  ON public.ai_draft_slots FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operator')
    OR public.user_has_access_to_loja(auth.uid(), unit_id)
  );

CREATE TRIGGER trg_ai_draft_slots_updated_at
  BEFORE UPDATE ON public.ai_draft_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_draft_slots;
ALTER TABLE public.ai_draft_slots REPLICA IDENTITY FULL;