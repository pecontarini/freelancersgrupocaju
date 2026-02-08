-- ============================================
-- LEADERSHIP PERFORMANCE SCORES TABLE
-- Stores derived metrics from audit calculations
-- Never modifies raw audit data
-- ============================================

-- Create table for storing calculated leadership performance scores
CREATE TABLE public.leadership_performance_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- YYYY-MM format
  position_code TEXT NOT NULL, -- chefe_salao, gerente_front, etc.
  
  -- Calculated metrics
  final_score NUMERIC,
  tier TEXT, -- ouro, prata, bronze, red_flag
  
  -- Breakdown by checklist type (JSON for flexibility)
  breakdown JSONB DEFAULT '[]'::jsonb,
  
  -- Audit tracking
  total_audits INTEGER DEFAULT 0,
  needs_review BOOLEAN DEFAULT false,
  review_reasons JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE (loja_id, month_year, position_code)
);

-- Create index for fast lookups
CREATE INDEX idx_leadership_performance_loja_month ON public.leadership_performance_scores(loja_id, month_year);
CREATE INDEX idx_leadership_performance_position ON public.leadership_performance_scores(position_code);
CREATE INDEX idx_leadership_performance_tier ON public.leadership_performance_scores(tier);

-- Enable RLS
ALTER TABLE public.leadership_performance_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "View leadership_performance based on role"
ON public.leadership_performance_scores
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Admins can manage leadership_performance"
ON public.leadership_performance_scores
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_leadership_performance_updated_at
BEFORE UPDATE ON public.leadership_performance_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- GENERAL STORE SCORES TABLE
-- Stores overall store performance per month
-- ============================================
CREATE TABLE public.leadership_store_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  
  -- Overall scores
  general_score NUMERIC,
  front_score NUMERIC,
  back_score NUMERIC,
  
  -- Tier classifications
  general_tier TEXT,
  front_tier TEXT,
  back_tier TEXT,
  
  -- Counts
  total_audits INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0,
  front_failures INTEGER DEFAULT 0,
  back_failures INTEGER DEFAULT 0,
  
  -- Metadata
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE (loja_id, month_year)
);

-- Create indexes
CREATE INDEX idx_leadership_store_scores_loja ON public.leadership_store_scores(loja_id);
CREATE INDEX idx_leadership_store_scores_month ON public.leadership_store_scores(month_year);

-- Enable RLS
ALTER TABLE public.leadership_store_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "View store_scores based on role"
ON public.leadership_store_scores
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Admins can manage store_scores"
ON public.leadership_store_scores
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_leadership_store_scores_updated_at
BEFORE UPDATE ON public.leadership_store_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- CALCULATION LOG TABLE
-- Tracks when calculations were performed
-- ============================================
CREATE TABLE public.leadership_calculation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  month_year TEXT,
  trigger_type TEXT NOT NULL, -- 'audit_insert', 'failure_insert', 'manual_backfill', 'rule_update'
  trigger_audit_id UUID REFERENCES public.supervision_audits(id) ON DELETE SET NULL,
  positions_updated INTEGER DEFAULT 0,
  stores_updated INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leadership_calculation_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage calculation logs
CREATE POLICY "Admins can view calculation_log"
ON public.leadership_calculation_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage calculation_log"
ON public.leadership_calculation_log
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));