-- Add separate budget columns for freelancers and maintenance
ALTER TABLE public.store_budgets 
ADD COLUMN IF NOT EXISTS freelancer_budget numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS maintenance_budget numeric NOT NULL DEFAULT 0;

-- Migrate existing data: split current budget_amount equally between categories
-- (This is a safe default - admins can adjust later)
UPDATE public.store_budgets 
SET freelancer_budget = budget_amount / 2,
    maintenance_budget = budget_amount / 2
WHERE budget_amount > 0;

-- Add a generated column for total_budget (auto-calculated)
ALTER TABLE public.store_budgets 
ADD COLUMN IF NOT EXISTS total_budget numeric GENERATED ALWAYS AS (freelancer_budget + maintenance_budget) STORED;

-- Drop the old budget_amount column since we now have separate columns
ALTER TABLE public.store_budgets DROP COLUMN IF EXISTS budget_amount;