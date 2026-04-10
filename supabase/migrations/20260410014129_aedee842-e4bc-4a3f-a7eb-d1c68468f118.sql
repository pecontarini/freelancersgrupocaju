-- Add schedule_id column to link checkins directly to schedules
ALTER TABLE public.freelancer_checkins
ADD COLUMN schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL;