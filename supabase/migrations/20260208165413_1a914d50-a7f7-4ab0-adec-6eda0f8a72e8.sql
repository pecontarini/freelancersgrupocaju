-- Create daily_sales table for CMV sales data
CREATE TABLE public.daily_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_id UUID NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Anti-duplicity constraint: same item + date + unit = unique record
  CONSTRAINT daily_sales_unique_entry UNIQUE (sale_date, item_name, unit_id)
);

-- Create indexes for common queries
CREATE INDEX idx_daily_sales_unit_date ON public.daily_sales(unit_id, sale_date);
CREATE INDEX idx_daily_sales_item_name ON public.daily_sales(item_name);

-- Enable RLS
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "View daily_sales based on role"
  ON public.daily_sales
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR user_has_access_to_loja(auth.uid(), unit_id)
  );

CREATE POLICY "Insert daily_sales based on role"
  ON public.daily_sales
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR user_has_access_to_loja(auth.uid(), unit_id)
  );

CREATE POLICY "Update daily_sales based on role"
  ON public.daily_sales
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR user_has_access_to_loja(auth.uid(), unit_id)
  );

CREATE POLICY "Delete daily_sales admin only"
  ON public.daily_sales
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_daily_sales_updated_at
  BEFORE UPDATE ON public.daily_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();