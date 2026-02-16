-- Change quantidade from integer to numeric to support decimal counts (e.g. 4.5 kg)
ALTER TABLE public.cmv_contagens 
ALTER COLUMN quantidade TYPE numeric USING quantidade::numeric;