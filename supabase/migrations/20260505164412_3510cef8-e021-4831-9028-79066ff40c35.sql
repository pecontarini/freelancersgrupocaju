
ALTER TABLE public.sheets_blocks_snapshot
  ALTER COLUMN loja_codigo SET DEFAULT '',
  ALTER COLUMN loja_codigo SET NOT NULL;

UPDATE public.sheets_blocks_snapshot SET loja_codigo = '' WHERE loja_codigo IS NULL;

DROP INDEX IF EXISTS public.sheets_blocks_unique_idx;

ALTER TABLE public.sheets_blocks_snapshot
  ADD CONSTRAINT sheets_blocks_unique
  UNIQUE (meta_key, mes_ref, block_key, loja_codigo);
