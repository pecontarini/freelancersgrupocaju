
-- =====================================================
-- PR 1 — Migration 1/N: AJ1 (inferência tipo='cpf')
-- =====================================================

-- 1. Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.freelancer_profiles_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.freelancer_profiles(id) ON DELETE CASCADE,
  before_chave_pix text,
  before_tipo_chave_pix text,
  after_chave_pix text,
  after_tipo_chave_pix text,
  inferred_at timestamptz NOT NULL DEFAULT now(),
  inferred_by text NOT NULL,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_audit_profile_id
  ON public.freelancer_profiles_audit(profile_id);
CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_audit_inferred_by
  ON public.freelancer_profiles_audit(inferred_by);

ALTER TABLE public.freelancer_profiles_audit ENABLE ROW LEVEL SECURITY;

-- Apenas admin lê auditoria
CREATE POLICY "Admins can view freelancer profile audit"
  ON public.freelancer_profiles_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Apenas admin pode inserir manualmente (migrations rodam como service_role e bypassam RLS)
CREATE POLICY "Admins can insert freelancer profile audit"
  ON public.freelancer_profiles_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Auditoria PRÉ-update: snapshot dos 826 candidatos AJ1
WITH base AS (
  SELECT id, cpf, chave_pix, tipo_chave_pix,
         regexp_replace(COALESCE(cpf,''),'\D','','g')      AS cpf_clean,
         regexp_replace(COALESCE(chave_pix,''),'\D','','g') AS pix_digits
  FROM public.freelancer_profiles
),
aj1 AS (
  SELECT id, chave_pix, tipo_chave_pix, cpf_clean
  FROM base
  WHERE (tipo_chave_pix IS NULL OR tipo_chave_pix = '')
    AND length(cpf_clean) = 11
    AND pix_digits = cpf_clean
)
INSERT INTO public.freelancer_profiles_audit (
  profile_id, before_chave_pix, before_tipo_chave_pix,
  after_chave_pix, after_tipo_chave_pix, inferred_by, notes
)
SELECT
  a.id,
  a.chave_pix,
  a.tipo_chave_pix,
  a.cpf_clean,
  'cpf',
  'migration_pr1_aj1',
  'Auto-inferred: chave_pix matched CPF (normalized to 11 digits)'
FROM aj1 a;

-- 3. UPDATE AJ1 — exatamente os mesmos 826 perfis
WITH base AS (
  SELECT id, cpf, chave_pix, tipo_chave_pix,
         regexp_replace(COALESCE(cpf,''),'\D','','g')      AS cpf_clean,
         regexp_replace(COALESCE(chave_pix,''),'\D','','g') AS pix_digits
  FROM public.freelancer_profiles
),
aj1 AS (
  SELECT id, cpf_clean
  FROM base
  WHERE (tipo_chave_pix IS NULL OR tipo_chave_pix = '')
    AND length(cpf_clean) = 11
    AND pix_digits = cpf_clean
)
UPDATE public.freelancer_profiles fp
SET tipo_chave_pix = 'cpf',
    chave_pix = aj1.cpf_clean
FROM aj1
WHERE fp.id = aj1.id;

-- 4. Flag dos 4 conflitos para revisão manual em "Cadastros pendentes"
WITH base AS (
  SELECT id, cpf, chave_pix, tipo_chave_pix,
         regexp_replace(COALESCE(cpf,''),'\D','','g')      AS cpf_clean,
         regexp_replace(COALESCE(chave_pix,''),'\D','','g') AS pix_digits
  FROM public.freelancer_profiles
),
aj1_normalized AS (
  -- Já está normalizado pelo passo 3; reconstrói o cpf_clean dos perfis AJ1
  SELECT id, cpf_clean FROM base
  WHERE tipo_chave_pix = 'cpf' AND length(cpf_clean) = 11
),
conflicts AS (
  SELECT DISTINCT fp2.id          AS conflict_profile_id,
                  fp2.chave_pix   AS before_chave_pix,
                  fp2.tipo_chave_pix AS before_tipo,
                  a.id            AS aj1_profile_id
  FROM aj1_normalized a
  JOIN public.freelancer_profiles fp2
    ON fp2.chave_pix = a.cpf_clean
   AND fp2.id <> a.id
)
INSERT INTO public.freelancer_profiles_audit (
  profile_id, before_chave_pix, before_tipo_chave_pix,
  after_chave_pix, after_tipo_chave_pix, inferred_by, notes
)
SELECT
  c.conflict_profile_id,
  c.before_chave_pix,
  c.before_tipo,
  c.before_chave_pix,                  -- não alteramos
  c.before_tipo,                       -- não alteramos
  'migration_pr1_aj1_conflict_flag',
  'Conflict: chave_pix duplicates the normalized CPF of profile ' || c.aj1_profile_id::text
   || '. Left untouched. Will appear in "Cadastros pendentes" until operator reconciles.'
FROM conflicts c;
