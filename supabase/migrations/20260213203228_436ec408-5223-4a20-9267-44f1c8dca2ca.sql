
-- ============================================
-- AUDIT SECTOR SCORES TABLE
-- Stores calculated scores per sector per checklist type per audit
-- This enables the "average of averages by sector" logic
-- ============================================

CREATE TABLE public.audit_sector_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES public.supervision_audits(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES public.config_lojas(id),
  sector_code TEXT NOT NULL,         -- e.g. 'salao', 'bar', 'cozinha', etc.
  checklist_type TEXT NOT NULL,      -- 'SUPERVISOR', 'FISCAL', 'AUDITORIA_DE_ALIMENTOS'
  score NUMERIC NOT NULL DEFAULT 0,  -- percentage score for this sector in this audit
  total_points NUMERIC DEFAULT 0,    -- total possible points (weighted)
  earned_points NUMERIC DEFAULT 0,   -- actual points earned (weighted)
  item_count INTEGER DEFAULT 0,      -- number of items evaluated
  audit_date DATE NOT NULL,
  month_year TEXT NOT NULL,          -- 'YYYY-MM' format for quick grouping
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_audit_sector_scores_loja_month ON public.audit_sector_scores(loja_id, month_year);
CREATE INDEX idx_audit_sector_scores_audit ON public.audit_sector_scores(audit_id);
CREATE INDEX idx_audit_sector_scores_sector_type ON public.audit_sector_scores(sector_code, checklist_type);

-- Unique constraint: one score per sector per checklist type per audit
CREATE UNIQUE INDEX idx_audit_sector_scores_unique ON public.audit_sector_scores(audit_id, sector_code, checklist_type);

-- Enable RLS
ALTER TABLE public.audit_sector_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage audit_sector_scores"
ON public.audit_sector_scores
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "View audit_sector_scores based on role"
ON public.audit_sector_scores
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

-- Trigger for updated_at
CREATE TRIGGER update_audit_sector_scores_updated_at
BEFORE UPDATE ON public.audit_sector_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
