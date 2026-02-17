-- Add extras_count column to staffing_matrix
ALTER TABLE public.staffing_matrix
ADD COLUMN extras_count integer NOT NULL DEFAULT 0;