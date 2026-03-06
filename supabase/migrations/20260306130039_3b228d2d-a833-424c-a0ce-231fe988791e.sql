
-- Add apoio_venda_budget column
ALTER TABLE public.store_budgets ADD COLUMN apoio_venda_budget numeric NOT NULL DEFAULT 0;

-- Drop and recreate total_budget as generated column including new category
ALTER TABLE public.store_budgets DROP COLUMN total_budget;
ALTER TABLE public.store_budgets ADD COLUMN total_budget numeric GENERATED ALWAYS AS (
  freelancer_budget + maintenance_budget + uniforms_budget + cleaning_budget + utensils_budget + apoio_venda_budget
) STORED;
