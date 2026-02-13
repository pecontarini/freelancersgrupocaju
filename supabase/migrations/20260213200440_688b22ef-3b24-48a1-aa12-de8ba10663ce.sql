
-- Add utensils_budget column
ALTER TABLE public.store_budgets 
ADD COLUMN utensils_budget numeric NOT NULL DEFAULT 0;

-- Drop the generated total column and recreate including utensils
ALTER TABLE public.store_budgets DROP COLUMN total_budget;

ALTER TABLE public.store_budgets 
ADD COLUMN total_budget numeric GENERATED ALWAYS AS (freelancer_budget + maintenance_budget + uniforms_budget + cleaning_budget + utensils_budget) STORED;
