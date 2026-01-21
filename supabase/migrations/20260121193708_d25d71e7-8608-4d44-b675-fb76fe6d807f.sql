-- Add new budget columns to store_budgets
ALTER TABLE public.store_budgets 
ADD COLUMN uniforms_budget numeric NOT NULL DEFAULT 0,
ADD COLUMN cleaning_budget numeric NOT NULL DEFAULT 0;

-- Update total_budget to include all categories
ALTER TABLE public.store_budgets 
DROP COLUMN total_budget;

ALTER TABLE public.store_budgets 
ADD COLUMN total_budget numeric GENERATED ALWAYS AS (freelancer_budget + maintenance_budget + uniforms_budget + cleaning_budget) STORED;

-- Create operational_expenses table for quick expense entries
CREATE TABLE public.operational_expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('uniformes', 'limpeza')),
    valor numeric NOT NULL CHECK (valor > 0),
    data_despesa date NOT NULL DEFAULT CURRENT_DATE,
    descricao text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.operational_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for operational_expenses
CREATE POLICY "View operational expenses based on role"
ON public.operational_expenses
FOR SELECT
USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR user_has_access_to_loja(auth.uid(), store_id)
);

CREATE POLICY "Insert operational expenses based on role"
ON public.operational_expenses
FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR user_has_access_to_loja(auth.uid(), store_id)
);

CREATE POLICY "Update operational expenses based on role"
ON public.operational_expenses
FOR UPDATE
USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR user_has_access_to_loja(auth.uid(), store_id)
);

CREATE POLICY "Delete operational expenses based on role"
ON public.operational_expenses
FOR DELETE
USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR user_has_access_to_loja(auth.uid(), store_id)
);