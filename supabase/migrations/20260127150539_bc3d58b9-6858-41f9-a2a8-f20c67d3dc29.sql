-- Create table for weekly performance entries (allows multiple entries per month)
CREATE TABLE public.store_performance_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    faturamento_salao NUMERIC NOT NULL DEFAULT 0,
    faturamento_delivery NUMERIC NOT NULL DEFAULT 0,
    reclamacoes_salao INTEGER NOT NULL DEFAULT 0,
    reclamacoes_ifood INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT
);

-- Enable RLS
ALTER TABLE public.store_performance_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all entries"
ON public.store_performance_entries
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store managers can view their store entries"
ON public.store_performance_entries
FOR SELECT
USING (user_has_access_to_loja(auth.uid(), loja_id));

-- Index for efficient monthly aggregations
CREATE INDEX idx_store_performance_entries_loja_date 
ON public.store_performance_entries(loja_id, entry_date);

-- Add comment for documentation
COMMENT ON TABLE public.store_performance_entries IS 'Weekly/periodic performance entries that accumulate within a month for ranking and projections';