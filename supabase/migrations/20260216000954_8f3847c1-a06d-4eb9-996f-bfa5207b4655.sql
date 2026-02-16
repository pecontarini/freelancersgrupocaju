-- Add chefe_setor to the app_role enum (must be committed alone)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'chefe_setor';