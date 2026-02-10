
-- Sectors per unit
CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view sectors"
  ON public.sectors FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage sectors"
  ON public.sectors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Shifts
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  type text NOT NULL DEFAULT 'almoco',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view shifts"
  ON public.shifts FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage shifts"
  ON public.shifts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Staffing Matrix (minimum headcount per sector/day/shift)
CREATE TABLE public.staffing_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift_type text NOT NULL DEFAULT 'almoco',
  required_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector_id, day_of_week, shift_type)
);

ALTER TABLE public.staffing_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view staffing_matrix"
  ON public.staffing_matrix FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage staffing_matrix"
  ON public.staffing_matrix FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Schedules (actual staff assignments)
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  schedule_date date NOT NULL,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View schedules based on role"
  ON public.schedules FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = user_id
  );

CREATE POLICY "Admins and managers can manage schedules"
  ON public.schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default shifts
INSERT INTO public.shifts (name, start_time, end_time, type) VALUES
  ('Almoço', '08:00', '16:00', 'almoco'),
  ('Jantar', '16:00', '00:00', 'jantar');
