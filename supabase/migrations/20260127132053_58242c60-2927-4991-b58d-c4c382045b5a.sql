-- Table for storing supervision checklist failures extracted from PDFs
CREATE TABLE public.supervision_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID REFERENCES public.config_lojas(id) ON DELETE CASCADE NOT NULL,
  audit_date DATE NOT NULL,
  global_score NUMERIC NOT NULL DEFAULT 0,
  pdf_url TEXT,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for individual failure items from checklists
CREATE TABLE public.supervision_failures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID REFERENCES public.supervision_audits(id) ON DELETE CASCADE NOT NULL,
  loja_id UUID REFERENCES public.config_lojas(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'validated'
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  resolution_photo_url TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  validated_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supervision_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_failures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supervision_audits
CREATE POLICY "View supervision_audits based on role"
ON public.supervision_audits
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Insert supervision_audits based on role"
ON public.supervision_audits
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Update supervision_audits based on role"
ON public.supervision_audits
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Delete supervision_audits based on role"
ON public.supervision_audits
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for supervision_failures
CREATE POLICY "View supervision_failures based on role"
ON public.supervision_failures
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Insert supervision_failures based on role"
ON public.supervision_failures
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Update supervision_failures based on role"
ON public.supervision_failures
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Delete supervision_failures admin only"
ON public.supervision_failures
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_supervision_audits_updated_at
BEFORE UPDATE ON public.supervision_audits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supervision_failures_updated_at
BEFORE UPDATE ON public.supervision_failures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for audit photos
INSERT INTO storage.buckets (id, name, public) VALUES ('audit-photos', 'audit-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audit photos
CREATE POLICY "Audit photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'audit-photos');

CREATE POLICY "Authenticated users can upload audit photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audit-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their audit photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'audit-photos' AND auth.uid() IS NOT NULL);