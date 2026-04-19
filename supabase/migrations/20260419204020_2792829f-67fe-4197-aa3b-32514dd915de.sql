-- 1) RPC SECURITY DEFINER para buscar dados de freelancer pelo CPF cross-loja
CREATE OR REPLACE FUNCTION public.lookup_freelancer_by_cpf(p_cpf text)
RETURNS TABLE (
  nome_completo text,
  funcao text,
  gerencia text,
  chave_pix text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fe.nome_completo, fe.funcao, fe.gerencia, fe.chave_pix
  FROM public.freelancer_entries fe
  WHERE fe.cpf = p_cpf
     OR REGEXP_REPLACE(fe.cpf, '\D', '', 'g') = REGEXP_REPLACE(p_cpf, '\D', '', 'g')
  ORDER BY fe.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_freelancer_by_cpf(text) TO anon, authenticated;

-- 2) Backfill: popular freelancer_profiles a partir do histórico mais recente de freelancer_entries
WITH ranked AS (
  SELECT 
    REGEXP_REPLACE(cpf, '\D', '', 'g') AS cpf_clean,
    nome_completo,
    chave_pix,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY REGEXP_REPLACE(cpf, '\D', '', 'g') 
      ORDER BY created_at DESC
    ) AS rn
  FROM public.freelancer_entries
  WHERE cpf IS NOT NULL AND TRIM(cpf) <> ''
)
INSERT INTO public.freelancer_profiles (cpf, nome_completo, chave_pix)
SELECT cpf_clean, nome_completo, chave_pix
FROM ranked
WHERE rn = 1
  AND LENGTH(cpf_clean) = 11
ON CONFLICT (cpf) DO NOTHING;