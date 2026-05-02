
-- Bucket privado para uploads temporários de PDF de importação de utensílios
INSERT INTO storage.buckets (id, name, public)
VALUES ('utensilios-imports', 'utensilios-imports', false)
ON CONFLICT (id) DO NOTHING;

-- Admins e operadores podem fazer upload
CREATE POLICY "Admins and operators can upload utensilios-imports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'utensilios-imports'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
);

-- Admins e operadores podem ler/listar
CREATE POLICY "Admins and operators can read utensilios-imports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'utensilios-imports'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
);

-- Admins e operadores podem deletar (cleanup)
CREATE POLICY "Admins and operators can delete utensilios-imports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'utensilios-imports'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
);
