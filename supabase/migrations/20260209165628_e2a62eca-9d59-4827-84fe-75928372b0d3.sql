
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0;
