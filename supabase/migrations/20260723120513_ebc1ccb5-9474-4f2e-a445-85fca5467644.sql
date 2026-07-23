
ALTER TABLE public.freelancer_entries
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fim time;

CREATE OR REPLACE FUNCTION public.create_public_freelancer_request(
  _tenant_slug text,
  _loja_id uuid,
  _data_pop date,
  _setor text,
  _funcao text,
  _motivo text,
  _substitui text,
  _solicitante_nome text,
  _solicitante_telefone text,
  _hora_inicio time DEFAULT NULL,
  _hora_fim time DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_loja_nome text;
  v_id uuid;
BEGIN
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
     OR coalesce(trim(_solicitante_nome), '') = ''
     OR _hora_inicio IS NULL
     OR _hora_fim IS NULL THEN
    RAISE EXCEPTION 'Preencha todos os campos obrigatórios.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.freelancer_entries (
    loja, loja_id, tenant_id, data_pop, setor, funcao,
    motivo, substitui, solicitante_nome, solicitante_telefone,
    hora_inicio, hora_fim,
    origem, status
  ) VALUES (
    v_loja_nome, _loja_id, v_tenant_id, _data_pop, _setor, _funcao,
    _motivo, _substitui, _solicitante_nome, _solicitante_telefone,
    _hora_inicio, _hora_fim,
    'publico', 'pendente'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
