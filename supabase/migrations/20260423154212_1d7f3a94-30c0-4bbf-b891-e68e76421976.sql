-- 1. Recreate the sync trigger schedule -> freelancer_entries
DROP TRIGGER IF EXISTS trg_sync_schedule_to_freelancer_entry ON public.schedules;

CREATE TRIGGER trg_sync_schedule_to_freelancer_entry
AFTER INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.sync_schedule_to_freelancer_entry();


-- 2. Create function that maintains a pending_schedule checkin stub
CREATE OR REPLACE FUNCTION public.create_pending_schedule_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp record;
  v_cpf_clean text;
  v_freelancer_id uuid;
BEGIN
  -- DELETE: remove any pending stub for the deleted schedule
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.freelancer_checkins
     WHERE schedule_id = OLD.id
       AND status = 'pending_schedule';
    RETURN OLD;
  END IF;

  -- Load employee
  SELECT e.* INTO v_emp
  FROM public.employees e
  WHERE e.id = NEW.employee_id;

  -- Only freelancers with CPF
  IF NOT FOUND OR v_emp.worker_type <> 'freelancer' OR COALESCE(v_emp.cpf, '') = '' THEN
    -- If schedule was previously linked, drop the stub
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.freelancer_checkins
       WHERE schedule_id = NEW.id
         AND status = 'pending_schedule';
    END IF;
    RETURN NEW;
  END IF;

  -- If schedule is cancelled / not working / no rate, remove stub
  IF NEW.status = 'cancelled'
     OR NEW.schedule_type <> 'working'
     OR COALESCE(NEW.agreed_rate, 0) <= 0 THEN
    DELETE FROM public.freelancer_checkins
     WHERE schedule_id = NEW.id
       AND status = 'pending_schedule';
    RETURN NEW;
  END IF;

  v_cpf_clean := regexp_replace(v_emp.cpf, '\D', '', 'g');

  -- Find or create the freelancer profile
  SELECT id INTO v_freelancer_id
  FROM public.freelancer_profiles
  WHERE regexp_replace(cpf, '\D', '', 'g') = v_cpf_clean
  LIMIT 1;

  IF v_freelancer_id IS NULL THEN
    INSERT INTO public.freelancer_profiles (cpf, nome_completo, telefone)
    VALUES (v_cpf_clean, v_emp.name, v_emp.phone)
    RETURNING id INTO v_freelancer_id;
  END IF;

  -- Upsert pending stub (only if there's no real checkin yet for this schedule)
  IF NOT EXISTS (
    SELECT 1 FROM public.freelancer_checkins
    WHERE schedule_id = NEW.id
      AND status <> 'pending_schedule'
  ) THEN
    -- Update existing pending stub if present
    UPDATE public.freelancer_checkins
       SET freelancer_id = v_freelancer_id,
           loja_id = v_emp.unit_id,
           checkin_date = NEW.schedule_date,
           valor_informado = NEW.agreed_rate
     WHERE schedule_id = NEW.id
       AND status = 'pending_schedule';

    IF NOT FOUND THEN
      BEGIN
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
      EXCEPTION WHEN others THEN
        RAISE WARNING 'create_pending_schedule_checkin skipped: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Trigger on schedules
DROP TRIGGER IF EXISTS trg_create_pending_schedule_checkin ON public.schedules;

CREATE TRIGGER trg_create_pending_schedule_checkin
AFTER INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.create_pending_schedule_checkin();