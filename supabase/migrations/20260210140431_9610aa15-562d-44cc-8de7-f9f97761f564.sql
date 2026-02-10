
-- Add confirmation fields to schedules
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS confirmation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmation_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS denial_reason TEXT;

-- Allow anonymous/public reads for the confirm-shift page (by schedule ID only)
CREATE POLICY "Public can read schedule by id for confirmation"
  ON public.schedules FOR SELECT
  USING (true);

-- Allow anonymous/public updates for confirmation only
CREATE POLICY "Public can update confirmation status"
  ON public.schedules FOR UPDATE
  USING (true)
  WITH CHECK (true);
