-- 1) Table
CREATE TABLE public.schedule_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL,
  schedule_date date NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  planned_minutes int,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedule_breaks_schedule ON public.schedule_breaks(schedule_id);
CREATE INDEX idx_schedule_breaks_unit_date ON public.schedule_breaks(unit_id, schedule_date);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_breaks TO authenticated;
GRANT ALL ON public.schedule_breaks TO service_role;

-- 3) RLS
ALTER TABLE public.schedule_breaks ENABLE ROW LEVEL SECURITY;

-- 4) Policies (mirror schedules patterns)
CREATE POLICY "Admins can manage schedule_breaks"
  ON public.schedule_breaks
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Unit users can view schedule_breaks"
  ON public.schedule_breaks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_stores us
      WHERE us.user_id = auth.uid()
        AND us.loja_id = schedule_breaks.unit_id
    )
  );

CREATE POLICY "Unit managers can manage schedule_breaks"
  ON public.schedule_breaks
  FOR ALL
  TO authenticated
  USING (
    (has_role(auth.uid(), 'gerente_unidade'::app_role)
     OR has_role(auth.uid(), 'operator'::app_role)
     OR has_role(auth.uid(), 'chefe_setor'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.user_stores us
      WHERE us.user_id = auth.uid()
        AND us.loja_id = schedule_breaks.unit_id
    )
  )
  WITH CHECK (
    (has_role(auth.uid(), 'gerente_unidade'::app_role)
     OR has_role(auth.uid(), 'operator'::app_role)
     OR has_role(auth.uid(), 'chefe_setor'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.user_stores us
      WHERE us.user_id = auth.uid()
        AND us.loja_id = schedule_breaks.unit_id
    )
  );

-- 5) updated_at trigger (reuse existing function)
CREATE TRIGGER trg_schedule_breaks_updated_at
  BEFORE UPDATE ON public.schedule_breaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();