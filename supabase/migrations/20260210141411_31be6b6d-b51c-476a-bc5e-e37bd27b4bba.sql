
-- Remove overly permissive public policies since we use edge function with service role
DROP POLICY IF EXISTS "Public can read schedule by id for confirmation" ON public.schedules;
DROP POLICY IF EXISTS "Public can update confirmation status" ON public.schedules;
