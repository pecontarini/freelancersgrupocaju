
-- Table to track attendance/check-in for scheduled employees
CREATE TABLE public.schedule_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  sector_id UUID NOT NULL REFERENCES public.sectors(id),
  attendance_date DATE NOT NULL,
  shift_id UUID NOT NULL REFERENCES public.shifts(id),
  status TEXT NOT NULL DEFAULT 'ausente' CHECK (status IN ('presente', 'ausente')),
  justificativa TEXT CHECK (justificativa IN ('atestado', 'falta_injustificada', 'atraso', 'remanejado')),
  remanejado_de_sector_id UUID REFERENCES public.sectors(id),
  remanejado_para_sector_id UUID REFERENCES public.sectors(id),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schedule_id)
);

-- Enable RLS
ALTER TABLE public.schedule_attendance ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read and manage attendance
CREATE POLICY "Authenticated users can view attendance"
  ON public.schedule_attendance FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert attendance"
  ON public.schedule_attendance FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance"
  ON public.schedule_attendance FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete attendance"
  ON public.schedule_attendance FOR DELETE
  TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_schedule_attendance_updated_at
  BEFORE UPDATE ON public.schedule_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
