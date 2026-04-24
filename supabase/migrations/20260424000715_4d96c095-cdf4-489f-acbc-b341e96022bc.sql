-- 1) Blindagem total: create_pending_manual_checkin
CREATE OR REPLACE FUNCTION public.create_pending_manual_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cpf_clean text;
  v_freelancer_id uuid;
  v_existing_stub_id uuid;
BEGIN
  BEGIN
    -- DELETE: remove pending stub linked to this entry
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.freelancer_checkins
       WHERE entry_id = OLD.id
         AND status = 'pending_schedule';
      RETURN OLD;
    END IF;

    -- Only handle manual entries
    IF COALESCE(NEW.origem, 'manual') <> 'manual' THEN
      RETURN NEW;
    END IF;

    v_cpf_clean := regexp_replace(COALESCE(NEW.cpf, ''), '\D', '', 'g');

    -- Require valid CPF (11 digits), valid loja, and date today/future (Sao Paulo)
    IF length(v_cpf_clean) <> 11
       OR NEW.loja_id IS NULL
       OR NEW.data_pop < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
      IF TG_OP = 'UPDATE' THEN
        DELETE FROM public.freelancer_checkins
         WHERE entry_id = NEW.id
           AND status = 'pending_schedule';
      END IF;
      RETURN NEW;
    END IF;

    -- Ensure freelancer profile exists (race-safe + format-safe via ON CONFLICT)
    INSERT INTO public.freelancer_profiles (cpf, nome_completo, chave_pix)
    VALUES (v_cpf_clean, NEW.nome_completo, NEW.chave_pix)
    ON CONFLICT (cpf) DO UPDATE
      SET nome_completo = COALESCE(public.freelancer_profiles.nome_completo, EXCLUDED.nome_completo),
          chave_pix = COALESCE(public.freelancer_profiles.chave_pix, EXCLUDED.chave_pix)
    RETURNING id INTO v_freelancer_id;

    IF v_freelancer_id IS NULL THEN
      SELECT id INTO v_freelancer_id
      FROM public.freelancer_profiles
      WHERE regexp_replace(cpf, '\D', '', 'g') = v_cpf_clean
      LIMIT 1;
    END IF;

    -- If a real (non-pending) checkin already exists for same freelancer/loja/date, do nothing
    IF EXISTS (
      SELECT 1 FROM public.freelancer_checkins
      WHERE freelancer_id = v_freelancer_id
        AND loja_id = NEW.loja_id
        AND checkin_date = NEW.data_pop
        AND status <> 'pending_schedule'
    ) THEN
      RETURN NEW;
    END IF;

    -- Update existing stub for this entry first (UPDATE flow)
    UPDATE public.freelancer_checkins
       SET freelancer_id = v_freelancer_id,
           loja_id = NEW.loja_id,
           checkin_date = NEW.data_pop,
           valor_informado = NEW.valor
     WHERE entry_id = NEW.id
       AND status = 'pending_schedule';

    IF FOUND THEN
      RETURN NEW;
    END IF;

    -- Look for an existing pending stub for same freelancer/loja/date
    SELECT id INTO v_existing_stub_id
    FROM public.freelancer_checkins
    WHERE freelancer_id = v_freelancer_id
      AND loja_id = NEW.loja_id
      AND checkin_date = NEW.data_pop
      AND status = 'pending_schedule'
    LIMIT 1;

    IF v_existing_stub_id IS NOT NULL THEN
      UPDATE public.freelancer_checkins
         SET entry_id = NEW.id
       WHERE id = v_existing_stub_id
         AND entry_id IS NULL;
      RETURN NEW;
    END IF;

    -- Otherwise create a new pending stub
    INSERT INTO public.freelancer_checkins (
      freelancer_id,
      loja_id,
      entry_id,
      checkin_date,
      checkin_at,
      checkin_selfie_url,
      status,
      valor_informado,
      valor_status
    ) VALUES (
      v_freelancer_id,
      NEW.loja_id,
      NEW.id,
      NEW.data_pop,
      (NEW.data_pop::timestamp at time zone 'America/Sao_Paulo'),
      '',
      'pending_schedule',
      NEW.valor,
      'pending'
    );

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'create_pending_manual_checkin failed for entry % : % (SQLSTATE %)', COALESCE(NEW.id::text, OLD.id::text, 'n/a'), SQLERRM, SQLSTATE;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END;
END;
$function$;

-- 2) Blindagem total: create_pending_schedule_checkin
CREATE OR REPLACE FUNCTION public.create_pending_schedule_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emp record;
  v_cpf_clean text;
  v_freelancer_id uuid;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.freelancer_checkins
       WHERE schedule_id = OLD.id
         AND status = 'pending_schedule';
      RETURN OLD;
    END IF;

    SELECT e.* INTO v_emp
    FROM public.employees e
    WHERE e.id = NEW.employee_id;

    IF NOT FOUND OR v_emp.worker_type <> 'freelancer' OR COALESCE(v_emp.cpf, '') = '' THEN
      IF TG_OP = 'UPDATE' THEN
        DELETE FROM public.freelancer_checkins
         WHERE schedule_id = NEW.id
           AND status = 'pending_schedule';
      END IF;
      RETURN NEW;
    END IF;

    IF NEW.status = 'cancelled'
       OR NEW.schedule_type <> 'working'
       OR COALESCE(NEW.agreed_rate, 0) <= 0 THEN
      DELETE FROM public.freelancer_checkins
       WHERE schedule_id = NEW.id
         AND status = 'pending_schedule';
      RETURN NEW;
    END IF;

    v_cpf_clean := regexp_replace(v_emp.cpf, '\D', '', 'g');

    -- Race-safe / format-safe profile upsert
    INSERT INTO public.freelancer_profiles (cpf, nome_completo, telefone)
    VALUES (v_cpf_clean, v_emp.name, v_emp.phone)
    ON CONFLICT (cpf) DO UPDATE
      SET nome_completo = COALESCE(public.freelancer_profiles.nome_completo, EXCLUDED.nome_completo),
          telefone = COALESCE(public.freelancer_profiles.telefone, EXCLUDED.telefone)
    RETURNING id INTO v_freelancer_id;

    IF v_freelancer_id IS NULL THEN
      SELECT id INTO v_freelancer_id
      FROM public.freelancer_profiles
      WHERE regexp_replace(cpf, '\D', '', 'g') = v_cpf_clean
      LIMIT 1;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.freelancer_checkins
      WHERE schedule_id = NEW.id
        AND status <> 'pending_schedule'
    ) THEN
      UPDATE public.freelancer_checkins
         SET freelancer_id = v_freelancer_id,
             loja_id = v_emp.unit_id,
             checkin_date = NEW.schedule_date,
             valor_informado = NEW.agreed_rate
       WHERE schedule_id = NEW.id
         AND status = 'pending_schedule';

      IF NOT FOUND THEN
        INSERT INTO public.freelancer_checkins (
          freelancer_id,
          loja_id,
          schedule_id,
          checkin_date,
          checkin_at,
          checkin_selfie_url,
          status,
          valor_informado,
          valor_status
        ) VALUES (
          v_freelancer_id,
          v_emp.unit_id,
          NEW.id,
          NEW.schedule_date,
          (NEW.schedule_date::timestamp at time zone 'America/Sao_Paulo'),
          '',
          'pending_schedule',
          NEW.agreed_rate,
          'pending'
        );
      END IF;
    END IF;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'create_pending_schedule_checkin failed for schedule % : % (SQLSTATE %)', COALESCE(NEW.id::text, OLD.id::text, 'n/a'), SQLERRM, SQLSTATE;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END;
END;
$function$;

-- 3) Blindagem total: sync_schedule_to_freelancer_entry
CREATE OR REPLACE FUNCTION public.sync_schedule_to_freelancer_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emp record;
  v_loja_nome text;
  v_funcao text;
  v_gerencia text;
  v_pix text;
  v_cpf_clean text;
BEGIN
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

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_schedule_to_freelancer_entry failed for schedule % : % (SQLSTATE %)', COALESCE(NEW.id::text, OLD.id::text, 'n/a'), SQLERRM, SQLSTATE;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END;
END;
$function$;

-- 4) Data fix: normaliza CPF histórico em freelancer_entries (apenas dígitos)
UPDATE public.freelancer_entries
   SET cpf = regexp_replace(cpf, '\D', '', 'g')
 WHERE cpf ~ '\D';