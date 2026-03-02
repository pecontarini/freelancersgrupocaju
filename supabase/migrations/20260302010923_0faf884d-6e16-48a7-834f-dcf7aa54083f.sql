
-- Add UPDATE policy for maintenance-attachments bucket
CREATE POLICY "Authenticated users can update maintenance attachments"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'maintenance-attachments' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'maintenance-attachments' AND auth.role() = 'authenticated');
