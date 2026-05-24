-- Drop overly permissive public RLS policies on schedules.
-- Public confirmation flows (confirm-shift, escala-aprovacao-*) all run through
-- edge functions that use the service role key and bypass RLS, so no public
-- direct-from-client access is needed.

DROP POLICY IF EXISTS "Public can read schedule by id for confirmation" ON public.schedules;
DROP POLICY IF EXISTS "Public can update confirmation status" ON public.schedules;
DROP POLICY IF EXISTS "Public can update confirmation fields only" ON public.schedules;