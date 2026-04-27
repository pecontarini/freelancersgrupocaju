ALTER TABLE public.missoes
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_calendar_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_missoes_google_event ON public.missoes(google_event_id) WHERE google_event_id IS NOT NULL;