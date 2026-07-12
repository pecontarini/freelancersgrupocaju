
CREATE POLICY "tenant_logos_super_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-logos' AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "tenant_logos_super_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tenant-logos' AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "tenant_logos_super_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tenant-logos' AND public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "tenant_logos_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tenant-logos');
