-- Garante unicidade (cargo_id, codigo_meta) em metas_cargo
CREATE UNIQUE INDEX IF NOT EXISTS metas_cargo_cargo_codigo_unique
  ON public.metas_cargo (cargo_id, codigo_meta);

-- Seed: cria meta tempo_prato (inativa, teto 0, peso 0) para cargos que ainda não têm
INSERT INTO public.metas_cargo (cargo_id, codigo_meta, teto_valor, peso, origem_dado, ativo)
SELECT c.id, 'tempo_prato'::codigo_meta, 0, 0, 'kds'::origem_dado, false
FROM public.cargos c
WHERE c.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.metas_cargo m
    WHERE m.cargo_id = c.id AND m.codigo_meta = 'tempo_prato'
  );