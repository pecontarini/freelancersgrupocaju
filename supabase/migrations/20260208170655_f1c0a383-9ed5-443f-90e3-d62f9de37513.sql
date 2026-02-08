-- Add is_global column to cmv_sales_mappings
ALTER TABLE public.cmv_sales_mappings 
ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster global mapping lookups
CREATE INDEX idx_cmv_sales_mappings_global ON public.cmv_sales_mappings(is_global) WHERE is_global = true;

-- Create table for ignored sales items (items that don't impact meat CMV)
CREATE TABLE public.cmv_ignored_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  reason TEXT,
  ignored_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Each item name can only be ignored once (global ignore)
  CONSTRAINT cmv_ignored_items_unique_name UNIQUE (item_name)
);

-- Create index for fast lookups
CREATE INDEX idx_cmv_ignored_items_name ON public.cmv_ignored_items(item_name);

-- Enable RLS
ALTER TABLE public.cmv_ignored_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone authenticated can view cmv_ignored_items"
  ON public.cmv_ignored_items
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage cmv_ignored_items"
  ON public.cmv_ignored_items
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));