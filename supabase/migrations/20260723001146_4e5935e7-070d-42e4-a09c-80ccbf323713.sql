ALTER TABLE public.freelancer_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.freelancer_entries;