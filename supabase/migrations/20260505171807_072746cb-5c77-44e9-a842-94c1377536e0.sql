ALTER TABLE public.sheets_blocks_snapshot ALTER COLUMN loja_codigo DROP NOT NULL;
DROP INDEX IF EXISTS sheets_blocks_snapshot_meta_key_mes_ref_block_key_loja_codi_key;
ALTER TABLE public.sheets_blocks_snapshot DROP CONSTRAINT IF EXISTS sheets_blocks_snapshot_meta_key_mes_ref_block_key_loja_codigo_key;
CREATE UNIQUE INDEX IF NOT EXISTS sheets_blocks_snapshot_unique_idx
  ON public.sheets_blocks_snapshot (meta_key, mes_ref, block_key, COALESCE(loja_codigo, '__GLOBAL__'));