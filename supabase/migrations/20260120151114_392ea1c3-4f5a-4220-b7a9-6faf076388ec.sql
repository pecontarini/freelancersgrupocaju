
-- Create store_budgets table for monthly budget configuration per store
CREATE TABLE public.store_budgets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
    budget_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(store_id, month_year)
);

-- Enable RLS
ALTER TABLE public.store_budgets ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage store budgets"
ON public.store_budgets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Store managers can view budgets for their stores
CREATE POLICY "Store managers can view their store budgets"
ON public.store_budgets
FOR SELECT
USING (user_has_access_to_loja(auth.uid(), store_id));

-- Create trigger for updated_at
CREATE TRIGGER update_store_budgets_updated_at
BEFORE UPDATE ON public.store_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_store_budgets_store_month ON public.store_budgets(store_id, month_year);
