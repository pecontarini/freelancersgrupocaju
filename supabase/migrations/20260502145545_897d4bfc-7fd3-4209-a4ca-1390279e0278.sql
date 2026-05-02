
ALTER TABLE public.items_catalog
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS fornecedor_sugerido TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('utensilios-photos', 'utensilios-photos', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Utensilios photos are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'utensilios-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload utensilios photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'utensilios-photos' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update utensilios photos"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'utensilios-photos' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can delete utensilios photos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'utensilios-photos' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
