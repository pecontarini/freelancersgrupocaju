-- Tablet check-in stations
CREATE TABLE IF NOT EXISTS public.checkin_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  station_name text NOT NULL DEFAULT 'Estação Principal',
  pin_hash text NOT NULL,
  created_by uuid,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkin_stations_loja ON public.checkin_stations(loja_id);

ALTER TABLE public.checkin_stations ENABLE ROW LEVEL SECURITY;

-- Public can read minimal info to verify PIN at boot (only loja_id + station_name + pin_hash via edge function)
-- For safety, only allow admin/operator to view from client
DROP POLICY IF EXISTS "Admins manage stations" ON public.checkin_stations;
CREATE POLICY "Admins manage stations"
ON public.checkin_stations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

-- Allow public select of station name+loja (no pin_hash exposure via app — rely on column-level view if needed)
-- We'll keep RLS strict; the edge function uses service role to verify PIN.

CREATE TRIGGER trg_checkin_stations_updated
BEFORE UPDATE ON public.checkin_stations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit column on freelancer_checkins
ALTER TABLE public.freelancer_checkins
  ADD COLUMN IF NOT EXISTS station_id uuid NULL REFERENCES public.checkin_stations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_freelancer_checkins_station ON public.freelancer_checkins(station_id);
