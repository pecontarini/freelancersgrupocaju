-- 1. Add entry_id column to freelancer_checkins
ALTER TABLE public.freelancer_checkins
ADD COLUMN IF NOT EXISTS entry_id uuid NULL REFERENCES public.freelancer_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_freelancer_checkins_entry_id
  ON public.freelancer_checkins(entry_id)
  WHERE entry_id IS NOT NULL;

-- 2. Recreate triggers on schedules (sync to budget + pending stub)
DROP TRIGGER IF EXISTS trg_sync_schedule_to_freelancer_entry ON public.schedules;
CREATE TRIGGER trg_sync_schedule_to_freelancer_entry
AFTER INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.sync_schedule_to_freelancer_entry();

DROP TRIGGER IF EXISTS trg_create_pending_schedule_checkin ON public.schedules;
CREATE TRIGGER trg_create_pending_schedule_checkin
AFTER INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.create_pending_schedule_checkin();

-- 3. New function: create pending stub from a manual freelancer_entries row
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

  -- Require valid CPF (11 digits), valid loja, and date today/future
  IF length(v_cpf_clean) <> 11
     OR NEW.loja_id IS NULL
     OR NEW.data_pop < CURRENT_DATE THEN
    -- If updated to invalid state, drop any previous stub for this entry
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.freelancer_checkins
       WHERE entry_id = NEW.id
         AND status = 'pending_schedule';
    END IF;
    RETURN NEW;
  END IF;

  -- Ensure freelancer profile exists
  SELECT id INTO v_freelancer_id
  FROM public.freelancer_profiles
  WHERE regexp_replace(cpf, '\D', '', 'g') = v_cpf_clean
  LIMIT 1;

  IF v_freelancer_id IS NULL THEN
    INSERT INTO public.freelancer_profiles (cpf, nome_completo, chave_pix)
    VALUES (v_cpf_clean, NEW.nome_completo, NEW.chave_pix)
    RETURNING id INTO v_freelancer_id;
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

  -- Try to update existing stub for this entry first (UPDATE flow)
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

  -- Look for an existing pending stub for same freelancer/loja/date (e.g. coming from schedule)
  SELECT id INTO v_existing_stub_id
  FROM public.freelancer_checkins
  WHERE freelancer_id = v_freelancer_id
    AND loja_id = NEW.loja_id
    AND checkin_date = NEW.data_pop
    AND status = 'pending_schedule'
  LIMIT 1;

  IF v_existing_stub_id IS NOT NULL THEN
    -- Attach entry_id to the existing stub (no duplicate)
    UPDATE public.freelancer_checkins
       SET entry_id = NEW.id
     WHERE id = v_existing_stub_id
       AND entry_id IS NULL;
    RETURN NEW;
  END IF;

  -- Otherwise create a new pending stub
  BEGIN
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
  EXCEPTION WHEN others THEN
    RAISE WARNING 'create_pending_manual_checkin skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_create_pending_manual_checkin ON public.freelancer_entries;
CREATE TRIGGER trg_create_pending_manual_checkin
AFTER INSERT OR UPDATE OR DELETE ON public.freelancer_entries
FOR EACH ROW EXECUTE FUNCTION public.create_pending_manual_checkin();

-- 4. Adjust promote_approved_checkins to also clean up manual freelancer_entries linked via entry_id
CREATE OR REPLACE FUNCTION public.promote_approved_checkins(p_approval_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_approval record;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_approval FROM checkin_approvals WHERE id = p_approval_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval not found';
  END IF;

  -- Remove provisional entries (origem='escala') for the schedules being promoted
  DELETE FROM public.freelancer_entries fe
  USING public.freelancer_checkins fc
  WHERE fc.id = ANY(v_approval.checkin_ids)
    AND fc.schedule_id IS NOT NULL
    AND fe.schedule_id = fc.schedule_id
    AND fe.origem = 'escala';

  -- Remove manual entries linked via entry_id (so the approved checkin replaces them)
  DELETE FROM public.freelancer_entries fe
  USING public.freelancer_checkins fc
  WHERE fc.id = ANY(v_approval.checkin_ids)
    AND fc.entry_id IS NOT NULL
    AND fe.id = fc.entry_id
    AND fe.origem = 'manual';

  INSERT INTO checkin_budget_entries (
    checkin_id, loja_id, freelancer_name, cpf, chave_pix, tipo_chave_pix,
    data_servico, checkin_at, checkout_at, valor, signed_by, signed_at, approval_id
  )
  SELECT
    fc.id,
    fc.loja_id,
    fp.nome_completo,
    fp.cpf,
    fp.chave_pix,
    fp.tipo_chave_pix,
    fc.checkin_date::date,
    fc.checkin_at,
    fc.checkout_at,
    fc.valor_aprovado,
    v_approval.approved_by,
    v_approval.approved_at,
    p_approval_id
  FROM freelancer_checkins fc
  JOIN freelancer_profiles fp ON fp.id = fc.freelancer_id
  WHERE fc.id = ANY(v_approval.checkin_ids)
    AND fc.status = 'approved'
    AND fc.valor_status = 'approved'
    AND fc.valor_aprovado IS NOT NULL
  ON CONFLICT (checkin_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;