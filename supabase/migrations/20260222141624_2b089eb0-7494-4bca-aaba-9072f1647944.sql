
-- Create audit_alerts table
CREATE TABLE public.audit_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_score', 'recurring_item', 'overdue_plan')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can see all alerts
CREATE POLICY "Admins can view all alerts"
ON public.audit_alerts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Managers can view alerts for their stores
CREATE POLICY "Managers can view their store alerts"
ON public.audit_alerts FOR SELECT
USING (public.user_has_access_to_loja(auth.uid(), loja_id));

-- Admins can update (mark as read)
CREATE POLICY "Admins can update alerts"
ON public.audit_alerts FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Managers can update their store alerts
CREATE POLICY "Managers can update their store alerts"
ON public.audit_alerts FOR UPDATE
USING (public.user_has_access_to_loja(auth.uid(), loja_id));

-- Service role can insert (edge function)
CREATE POLICY "Service can insert alerts"
ON public.audit_alerts FOR INSERT
WITH CHECK (true);

-- Admins can delete
CREATE POLICY "Admins can delete alerts"
ON public.audit_alerts FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Index for performance
CREATE INDEX idx_audit_alerts_loja_unread ON public.audit_alerts (loja_id, is_read) WHERE is_read = false;
CREATE INDEX idx_audit_alerts_created ON public.audit_alerts (created_at DESC);
