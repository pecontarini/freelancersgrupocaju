-- Create enum for action plan status
CREATE TYPE public.action_plan_status AS ENUM ('pending', 'in_analysis', 'resolved');

-- Create action_plans table for structured problem resolution
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  pain_tag TEXT NOT NULL, -- e.g. #Demora, #ComidaFria
  referencia_mes TEXT NOT NULL, -- e.g. 2026-01
  
  -- Justification fields
  causa_raiz TEXT,
  medida_tomada TEXT,
  acao_preventiva TEXT,
  evidencia_url TEXT,
  
  -- Workflow
  status action_plan_status NOT NULL DEFAULT 'pending',
  deadline_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  
  -- Audit trail
  created_by UUID REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique pain per store per month
  UNIQUE (loja_id, pain_tag, referencia_mes)
);

-- Create action_plan_comments table for timeline
CREATE TABLE public.action_plan_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_plan_id UUID NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_plan_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for action_plans
CREATE POLICY "View action_plans based on role"
ON public.action_plans
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Insert action_plans admin or store access"
ON public.action_plans
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Update action_plans based on role"
ON public.action_plans
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  user_has_access_to_loja(auth.uid(), loja_id)
);

CREATE POLICY "Delete action_plans admin only"
ON public.action_plans
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for action_plan_comments
CREATE POLICY "View comments based on plan access"
ON public.action_plan_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.action_plans ap 
    WHERE ap.id = action_plan_id 
    AND (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), ap.loja_id))
  )
);

CREATE POLICY "Insert comments if has plan access"
ON public.action_plan_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.action_plans ap 
    WHERE ap.id = action_plan_id 
    AND (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), ap.loja_id))
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_action_plans_updated_at
BEFORE UPDATE ON public.action_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for action plan evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('action-plan-evidence', 'action-plan-evidence', true);

-- Storage policies for evidence uploads
CREATE POLICY "Anyone can view action plan evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'action-plan-evidence');

CREATE POLICY "Authenticated users can upload evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'action-plan-evidence' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own evidence"
ON storage.objects FOR UPDATE
USING (bucket_id = 'action-plan-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own evidence"
ON storage.objects FOR DELETE
USING (bucket_id = 'action-plan-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);