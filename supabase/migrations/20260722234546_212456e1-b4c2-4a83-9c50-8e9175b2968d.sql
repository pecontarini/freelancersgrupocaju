
-- 1) Extend freelancer_entries for public requests
ALTER TABLE public.freelancer_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmado',
  ADD COLUMN IF NOT EXISTS solicitante_nome text,
  ADD COLUMN IF NOT EXISTS solicitante_telefone text;

-- Allow nullable fields for pending public requests
ALTER TABLE public.freelancer_entries ALTER COLUMN nome_completo DROP NOT NULL;
ALTER TABLE public.freelancer_entries ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE public.freelancer_entries ALTER COLUMN chave_pix DROP NOT NULL;
ALTER TABLE public.freelancer_entries ALTER COLUMN valor DROP NOT NULL;

-- Validate: confirmed rows must have all payment fields; pending rows may lack them
CREATE OR REPLACE FUNCTION public.validate_freelancer_entry_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.status, 'confirmado') = 'confirmado' THEN
    IF NEW.nome_completo IS NULL OR length(trim(NEW.nome_completo)) < 2
       OR NEW.cpf IS NULL OR length(regexp_replace(NEW.cpf, '\D', '', 'g')) <> 11
       OR NEW.chave_pix IS NULL OR length(trim(NEW.chave_pix)) < 1
       OR NEW.valor IS NULL OR NEW.valor <= 0 THEN
      RAISE EXCEPTION 'Lançamento confirmado exige nome, CPF, chave PIX e valor válidos.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_freelancer_entry_status ON public.freelancer_entries;
CREATE TRIGGER trg_validate_freelancer_entry_status
BEFORE INSERT OR UPDATE ON public.freelancer_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_freelancer_entry_status();

CREATE INDEX IF NOT EXISTS idx_freelancer_entries_status
  ON public.freelancer_entries(status)
  WHERE status = 'pendente';

-- 2) Public RPC: list active units for a tenant slug
CREATE OR REPLACE FUNCTION public.list_public_units(_tenant_slug text)
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cl.id, cl.nome
  FROM public.config_lojas cl
  JOIN public.tenants t ON t.id = cl.tenant_id
  WHERE cl.is_active = true
    AND t.slug = _tenant_slug
    AND COALESCE(t.ativo, true) = true
  ORDER BY cl.nome;
$$;

REVOKE ALL ON FUNCTION public.list_public_units(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_units(text) TO anon, authenticated;

-- 3) Public RPC: list sectors + linked job titles for a unit
CREATE OR REPLACE FUNCTION public.list_public_sectors_and_jobs(_loja_id uuid)
RETURNS TABLE(sector_id uuid, sector_name text, job_id uuid, job_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, j.id, j.name
  FROM public.sectors s
  LEFT JOIN public.sector_job_titles sjt ON sjt.sector_id = s.id
  LEFT JOIN public.job_titles j ON j.id = sjt.job_title_id
  WHERE s.unit_id = _loja_id
  ORDER BY s.name, j.name;
$$;

REVOKE ALL ON FUNCTION public.list_public_sectors_and_jobs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_sectors_and_jobs(uuid) TO anon, authenticated;

-- 4) Public RPC: create a pending freelancer request (no auth)
CREATE OR REPLACE FUNCTION public.create_public_freelancer_request(
  _tenant_slug text,
  _loja_id uuid,
  _data_pop date,
  _setor text,
  _funcao text,
  _motivo text,
  _substitui text,
  _solicitante_nome text,
  _solicitante_telefone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_loja_nome text;
  v_id uuid;
BEGIN
  -- Validate tenant + loja pairing
  SELECT cl.tenant_id, cl.nome
    INTO v_tenant_id, v_loja_nome
  FROM public.config_lojas cl
  JOIN public.tenants t ON t.id = cl.tenant_id
  WHERE cl.id = _loja_id
    AND cl.is_active = true
    AND t.slug = _tenant_slug
    AND COALESCE(t.ativo, true) = true;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Unidade inválida para a empresa informada.' USING ERRCODE = 'check_violation';
  END IF;

  IF _data_pop IS NULL
     OR coalesce(trim(_setor), '') = ''
     OR coalesce(trim(_funcao), '') = ''
     OR coalesce(trim(_motivo), '') = ''
     OR coalesce(trim(_substitui), '') = ''
     OR coalesce(trim(_solicitante_nome), '') = '' THEN
    RAISE EXCEPTION 'Preencha todos os campos obrigatórios.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.freelancer_entries (
    loja, loja_id, tenant_id, data_pop, setor, funcao,
    motivo, substitui, solicitante_nome, solicitante_telefone,
    origem, status
  ) VALUES (
    v_loja_nome, _loja_id, v_tenant_id, _data_pop, _setor, _funcao,
    _motivo, _substitui, _solicitante_nome, _solicitante_telefone,
    'publico', 'pendente'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_freelancer_request(text,uuid,date,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_freelancer_request(text,uuid,date,text,text,text,text,text,text) TO anon, authenticated;
