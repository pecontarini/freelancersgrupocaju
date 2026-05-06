
ALTER TABLE public.escala_minima DROP CONSTRAINT IF EXISTS escala_minima_turno_check;
ALTER TABLE public.escala_minima ADD CONSTRAINT escala_minima_turno_check CHECK (turno IN ('ALMOCO','JANTAR','TARDE'));
