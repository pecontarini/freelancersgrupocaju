-- Fix function search_path for normalize_sales_item_name
CREATE OR REPLACE FUNCTION public.normalize_sales_item_name(name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN UPPER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')));
END;
$$;

-- Fix function search_path for update_cmv_pending_updated_at
CREATE OR REPLACE FUNCTION public.update_cmv_pending_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;