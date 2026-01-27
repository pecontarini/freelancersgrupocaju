-- Create enum for position types (cargos)
CREATE TYPE public.position_type AS ENUM ('gerente_front', 'gerente_back', 'chefia_front', 'chefia_back');

-- Create enum for sector types
CREATE TYPE public.sector_type AS ENUM ('salao', 'back', 'apv', 'delivery');

-- Create enum for bonus tier levels
CREATE TYPE public.bonus_tier AS ENUM ('ouro', 'prata', 'bronze', 'aceitavel');

-- Create enum for KPI types
CREATE TYPE public.kpi_type AS ENUM ('nps', 'supervisao', 'tempo_prato', 'tempo_comanda');

-- Create table for NPS efficiency targets per sector
CREATE TABLE public.nps_targets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sector_type sector_type NOT NULL,
    tier bonus_tier NOT NULL,
    min_efficiency NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(sector_type, tier)
);

-- Create table for bonus percentage rules per position
CREATE TABLE public.bonus_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    position_type position_type NOT NULL,
    tier bonus_tier NOT NULL,
    percentage NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(position_type, tier)
);

-- Create table for bonus values configuration per store/position
CREATE TABLE public.bonus_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id UUID REFERENCES public.config_lojas(id) ON DELETE CASCADE,
    position_type position_type NOT NULL,
    base_bonus_value NUMERIC NOT NULL DEFAULT 0,
    month_year TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(loja_id, position_type, month_year)
);

-- Create table for monthly performance metrics per store
CREATE TABLE public.store_performance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id UUID REFERENCES public.config_lojas(id) ON DELETE CASCADE NOT NULL,
    month_year TEXT NOT NULL,
    faturamento NUMERIC NOT NULL DEFAULT 0,
    num_reclamacoes INTEGER NOT NULL DEFAULT 0,
    nps_score NUMERIC,
    supervisao_score NUMERIC NOT NULL DEFAULT 0,
    tempo_prato_avg NUMERIC,
    tempo_comanda_avg NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(loja_id, month_year)
);

-- Enable RLS on all tables
ALTER TABLE public.nps_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_performance ENABLE ROW LEVEL SECURITY;

-- RLS policies for nps_targets (read by all authenticated, manage by admin)
CREATE POLICY "Anyone authenticated can view nps_targets" 
ON public.nps_targets 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage nps_targets" 
ON public.nps_targets 
FOR ALL 
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS policies for bonus_rules (read by all authenticated, manage by admin)
CREATE POLICY "Anyone authenticated can view bonus_rules" 
ON public.bonus_rules 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage bonus_rules" 
ON public.bonus_rules 
FOR ALL 
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS policies for bonus_config (read based on role, manage by admin)
CREATE POLICY "View bonus_config based on role" 
ON public.bonus_config 
FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Only admins can manage bonus_config" 
ON public.bonus_config 
FOR ALL 
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS policies for store_performance (read based on role, manage by admin)
CREATE POLICY "View store_performance based on role" 
ON public.store_performance 
FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Only admins can manage store_performance" 
ON public.store_performance 
FOR ALL 
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create triggers for updated_at columns
CREATE TRIGGER update_nps_targets_updated_at
BEFORE UPDATE ON public.nps_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bonus_rules_updated_at
BEFORE UPDATE ON public.bonus_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bonus_config_updated_at
BEFORE UPDATE ON public.bonus_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_performance_updated_at
BEFORE UPDATE ON public.store_performance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed NPS efficiency targets based on documents
-- Salão/Back: Ouro (>120k), Prata (>95k), Bronze (>70k)
INSERT INTO public.nps_targets (sector_type, tier, min_efficiency) VALUES
('salao', 'ouro', 120000),
('salao', 'prata', 95000),
('salao', 'bronze', 70000),
('back', 'ouro', 120000),
('back', 'prata', 95000),
('back', 'bronze', 70000),
-- APV/Delivery: Ouro (>12k), Prata (>10k), Bronze (>8k)
('apv', 'ouro', 12000),
('apv', 'prata', 10000),
('apv', 'bronze', 8000),
('delivery', 'ouro', 12000),
('delivery', 'prata', 10000),
('delivery', 'bronze', 8000);

-- Seed bonus percentage rules
-- Gerentes: Ouro (100%), Prata (75%), Bronze (50%), Aceitável (25%)
INSERT INTO public.bonus_rules (position_type, tier, percentage) VALUES
('gerente_front', 'ouro', 100),
('gerente_front', 'prata', 75),
('gerente_front', 'bronze', 50),
('gerente_front', 'aceitavel', 25),
('gerente_back', 'ouro', 100),
('gerente_back', 'prata', 75),
('gerente_back', 'bronze', 50),
('gerente_back', 'aceitavel', 25),
-- Chefias: Ouro (100%), Prata (66.6%), Bronze (33.3%)
('chefia_front', 'ouro', 100),
('chefia_front', 'prata', 66.6),
('chefia_front', 'bronze', 33.3),
('chefia_back', 'ouro', 100),
('chefia_back', 'prata', 66.6),
('chefia_back', 'bronze', 33.3);