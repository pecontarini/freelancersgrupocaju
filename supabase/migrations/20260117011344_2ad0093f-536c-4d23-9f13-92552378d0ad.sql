-- Create maintenance_entries table
CREATE TABLE public.maintenance_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  loja_id UUID REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  loja TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  data_servico DATE NOT NULL,
  numero_nf TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  descricao TEXT,
  anexo_url TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- Create maintenance_budgets table for monthly budget settings
CREATE TABLE public.maintenance_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  loja_id UUID REFERENCES public.config_lojas(id) ON DELETE CASCADE UNIQUE,
  budget_mensal NUMERIC NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.maintenance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_budgets ENABLE ROW LEVEL SECURITY;

-- RLS policies for maintenance_entries
CREATE POLICY "View maintenance entries based on role"
ON public.maintenance_entries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Insert maintenance entries based on role"
ON public.maintenance_entries
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Update maintenance entries based on role"
ON public.maintenance_entries
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Delete maintenance entries based on role"
ON public.maintenance_entries
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

-- RLS policies for maintenance_budgets
CREATE POLICY "View maintenance budgets based on role"
ON public.maintenance_budgets
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "Admins can manage maintenance budgets"
ON public.maintenance_budgets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for maintenance attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance-attachments', 'maintenance-attachments', true);

-- Storage policies for maintenance attachments
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'maintenance-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view maintenance attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'maintenance-attachments');

CREATE POLICY "Users can delete their own attachments"
ON storage.objects
FOR DELETE
USING (bucket_id = 'maintenance-attachments' AND auth.role() = 'authenticated');

-- Trigger for updated_at on maintenance_budgets
CREATE TRIGGER update_maintenance_budgets_updated_at
BEFORE UPDATE ON public.maintenance_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();