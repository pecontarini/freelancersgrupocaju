-- Add chave_pix field to maintenance_entries table
ALTER TABLE public.maintenance_entries 
ADD COLUMN chave_pix text;