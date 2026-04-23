-- ============================================================
-- 1. Normalizar CPF legado em freelancer_profiles (mesclando duplicados)
-- ============================================================
DO $$
DECLARE
  r record;
  v_clean text;
  v_existing_id uuid;
BEGIN
  FOR r IN
    SELECT id, cpf, nome_completo, telefone, chave_pix, tipo_chave_pix, foto_url, created_at
    FROM public.freelancer_profiles
    WHERE cpf ~ '\D'
  LOOP
    v_clean := regexp_replace(r.cpf, '\D', '', 'g');
    IF length(v_clean) <> 11 THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_existing_id
    FROM public.freelancer_profiles
    WHERE cpf = v_clean AND id <> r.id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- merge: preencher campos vazios do canônico com os do duplicado
      UPDATE public.freelancer_profiles tgt
         SET telefone       = COALESCE(tgt.telefone, r.telefone),
             chave_pix      = COALESCE(tgt.chave_pix, r.chave_pix),
             tipo_chave_pix = COALESCE(tgt.tipo_chave_pix, r.tipo_chave_pix),
             foto_url       = COALESCE(tgt.foto_url, r.foto_url),
             nome_completo  = CASE WHEN length(coalesce(tgt.nome_completo,'')) >= length(coalesce(r.nome_completo,''))
                                   THEN tgt.nome_completo ELSE r.nome_completo END
       WHERE tgt.id = v_existing_id;

      -- repointa freelancer_checkins para o canônico
      UPDATE public.freelancer_checkins
         SET freelancer_id = v_existing_id
       WHERE freelancer_id = r.id;

      DELETE FROM public.freelancer_profiles WHERE id = r.id;
    ELSE
      UPDATE public.freelancer_profiles SET cpf = v_clean WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 2. Normalizar CPF em freelancer_entries (sem unique)
-- ============================================================
UPDATE public.freelancer_entries
   SET cpf = regexp_replace(cpf, '\D', '', 'g')
 WHERE cpf ~ '\D'
   AND length(regexp_replace(cpf, '\D', '', 'g')) = 11;

-- ============================================================
-- 3. RPC unificado: lookup_freelancer_unified
-- ============================================================
CREATE OR REPLACE FUNCTION public.lookup_freelancer_unified(p_cpf text)
RETURNS TABLE(
  nome_completo text,
  funcao text,
  gerencia text,
  chave_pix text,
  tipo_chave_pix text,
  telefone text,
  foto_url text,
  found_in text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_profile record;
  v_employee record;
  v_entry record;
  v_found text[] := ARRAY[]::text[];
BEGIN
  v_clean := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  IF length(v_clean) <> 11 THEN
    RETURN;
  END IF;

  -- 1) cadastro central
  SELECT fp.nome_completo, fp.telefone, fp.chave_pix, fp.tipo_chave_pix, fp.foto_url
    INTO v_profile
  FROM public.freelancer_profiles fp
  WHERE regexp_replace(fp.cpf, '\D', '', 'g') = v_clean
  LIMIT 1;
  IF v_profile.nome_completo IS NOT NULL THEN
    v_found := array_append(v_found, 'freelancer_profiles');
  END IF;

  -- 2) employees (escala) — qualquer unidade, pega o mais recente ativo
  SELECT e.name, e.phone, COALESCE(j.name, e.job_title) AS funcao
    INTO v_employee
  FROM public.employees e
  LEFT JOIN public.job_titles j ON j.id = e.job_title_id
  WHERE e.worker_type = 'freelancer'
    AND regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') = v_clean
  ORDER BY e.active DESC, e.updated_at DESC
  LIMIT 1;
  IF v_employee.name IS NOT NULL THEN
    v_found := array_append(v_found, 'employees');
  END IF;

  -- 3) histórico de budget (mais recente)
  SELECT fe.nome_completo, fe.funcao, fe.gerencia, fe.chave_pix
    INTO v_entry
  FROM public.freelancer_entries fe
  WHERE regexp_replace(fe.cpf, '\D', '', 'g') = v_clean
  ORDER BY fe.created_at DESC
  LIMIT 1;
  IF v_entry.nome_completo IS NOT NULL THEN
    v_found := array_append(v_found, 'freelancer_entries');
  END IF;

  IF array_length(v_found, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_profile.nome_completo, v_employee.name, v_entry.nome_completo)::text AS nome_completo,
    COALESCE(v_employee.funcao, v_entry.funcao)::text                                AS funcao,
    v_entry.gerencia::text                                                           AS gerencia,
    COALESCE(v_profile.chave_pix, v_entry.chave_pix)::text                           AS chave_pix,
    v_profile.tipo_chave_pix::text                                                   AS tipo_chave_pix,
    COALESCE(v_profile.telefone, v_employee.phone)::text                             AS telefone,
    v_profile.foto_url::text                                                         AS foto_url,
    v_found                                                                          AS found_in;
END;
$$;

-- ============================================================
-- 4. Trigger sync_schedule_to_freelancer_entry: normaliza CPF
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_schedule_to_freelancer_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp record;
  v_loja_nome text;
  v_funcao text;
  v_gerencia text;
  v_pix text;
  v_cpf_clean text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.freelancer_entries
     WHERE schedule_id = OLD.id AND origem = 'escala';
    RETURN OLD;
  END IF;

  SELECT e.*, j.name AS job_title_name
    INTO v_emp
  FROM public.employees e
  LEFT JOIN public.job_titles j ON j.id = e.job_title_id
  WHERE e.id = NEW.employee_id;

  IF NOT FOUND OR v_emp.worker_type <> 'freelancer' THEN
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.freelancer_entries
       WHERE schedule_id = NEW.id AND origem = 'escala';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled'
     OR NEW.schedule_type <> 'working'
     OR COALESCE(NEW.agreed_rate, 0) <= 0 THEN
    DELETE FROM public.freelancer_entries
     WHERE schedule_id = NEW.id AND origem = 'escala';
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.checkin_budget_entries cbe
    JOIN public.freelancer_checkins fc ON fc.id = cbe.checkin_id
    WHERE fc.schedule_id = NEW.id
  ) THEN
    DELETE FROM public.freelancer_entries
     WHERE schedule_id = NEW.id AND origem = 'escala';
    RETURN NEW;
  END IF;

  SELECT nome INTO v_loja_nome FROM public.config_lojas WHERE id = v_emp.unit_id;

  v_funcao := COALESCE(v_emp.job_title_name, v_emp.job_title, 'Freelancer');
  v_gerencia := 'Operacional';
  v_cpf_clean := regexp_replace(COALESCE(v_emp.cpf, ''), '\D', '', 'g');

  SELECT COALESCE(fp.chave_pix, '') INTO v_pix
  FROM public.freelancer_profiles fp
  WHERE regexp_replace(fp.cpf, '\D', '', 'g') = v_cpf_clean
  LIMIT 1;
  v_pix := COALESCE(NULLIF(v_pix, ''), v_cpf_clean);

  BEGIN
    INSERT INTO public.freelancer_entries (
      loja, nome_completo, funcao, gerencia, data_pop, valor,
      cpf, chave_pix, loja_id, schedule_id, origem
    ) VALUES (
      COALESCE(v_loja_nome, ''),
      v_emp.name,
      v_funcao,
      v_gerencia,
      NEW.schedule_date,
      NEW.agreed_rate,
      v_cpf_clean,
      v_pix,
      v_emp.unit_id,
      NEW.id,
      'escala'
    )
    ON CONFLICT (schedule_id) WHERE schedule_id IS NOT NULL AND origem = 'escala'
    DO UPDATE SET
      nome_completo = EXCLUDED.nome_completo,
      funcao = EXCLUDED.funcao,
      data_pop = EXCLUDED.data_pop,
      valor = EXCLUDED.valor,
      cpf = EXCLUDED.cpf,
      chave_pix = EXCLUDED.chave_pix,
      loja = EXCLUDED.loja,
      loja_id = EXCLUDED.loja_id;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'sync_schedule_to_freelancer_entry skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;