-- Add unique constraint for upsert on cmv_inventory (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cmv_inventory_cmv_item_id_loja_id_key'
    ) THEN
        ALTER TABLE public.cmv_inventory 
        ADD CONSTRAINT cmv_inventory_cmv_item_id_loja_id_key 
        UNIQUE (cmv_item_id, loja_id);
    END IF;
END $$;

-- Update RLS policy to allow gerentes to upsert inventory for their stores
DROP POLICY IF EXISTS "Manage cmv_inventory admin only" ON public.cmv_inventory;

CREATE POLICY "Manage cmv_inventory based on role"
ON public.cmv_inventory
FOR ALL
USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR user_has_access_to_loja(auth.uid(), loja_id)
)
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR user_has_access_to_loja(auth.uid(), loja_id)
);