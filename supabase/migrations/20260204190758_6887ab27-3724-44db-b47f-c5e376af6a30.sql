-- Create table for audit upload notifications
CREATE TABLE public.audit_upload_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_id UUID REFERENCES public.supervision_audits(id) ON DELETE CASCADE,
    loja_id UUID NOT NULL REFERENCES public.config_lojas(id),
    uploaded_by UUID NOT NULL,
    uploader_name TEXT,
    uploader_role TEXT,
    global_score NUMERIC,
    failure_count INTEGER DEFAULT 0,
    viewed_by_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_upload_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all audit upload logs"
ON public.audit_upload_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Users can insert their own logs
CREATE POLICY "Users can insert their own audit upload logs"
ON public.audit_upload_logs
FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- Admins can update (mark as viewed)
CREATE POLICY "Admins can update audit upload logs"
ON public.audit_upload_logs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));