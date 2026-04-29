ALTER TABLE public.holding_staffing_config
ADD COLUMN IF NOT EXISTS regime text
  NOT NULL DEFAULT '5x2'
  CHECK (regime IN ('5x2', '6x1'));