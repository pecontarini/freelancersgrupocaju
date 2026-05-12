
-- ============ pix_validation_log ============
CREATE TABLE public.pix_validation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.freelancer_profiles(id) ON DELETE SET NULL,
  attempted_chave_pix text,
  attempted_tipo_chave_pix text,
  would_reject boolean NOT NULL DEFAULT false,
  rejection_reason text CHECK (rejection_reason IN (
    'uuid_aleatoria','cpf_mismatch','email_invalid','phone_invalid','empty_or_null','other'
  )),
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE')),
  triggered_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pix_validation_log_profile ON public.pix_validation_log(profile_id);
CREATE INDEX idx_pix_validation_log_reason ON public.pix_validation_log(rejection_reason);
CREATE INDEX idx_pix_validation_log_created ON public.pix_validation_log(created_at DESC);

ALTER TABLE public.pix_validation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/operator can read pix log"
ON public.pix_validation_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

-- No INSERT policy: trigger uses SECURITY DEFINER and bypasses RLS via owner.
-- Block direct client inserts/updates/deletes by omitting policies.

-- ============ whatsapp_dispatch_queue ============
CREATE TABLE public.whatsapp_dispatch_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.freelancer_profiles(id) ON DELETE CASCADE,
  telefone text,
  message_template text NOT NULL,
  magic_link_token text,
  magic_link_expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  sent_at timestamptz,
  error_message text,
  dispatched_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_dispatch_queue_profile ON public.whatsapp_dispatch_queue(profile_id);
CREATE INDEX idx_wa_dispatch_queue_status ON public.whatsapp_dispatch_queue(status);

ALTER TABLE public.whatsapp_dispatch_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/operator manage WA queue"
ON public.whatsapp_dispatch_queue FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator'));

CREATE TRIGGER trg_wa_dispatch_updated_at
BEFORE UPDATE ON public.whatsapp_dispatch_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ freelancer_profiles.update_requested_by ============
ALTER TABLE public.freelancer_profiles
  ADD COLUMN update_requested_by uuid,
  ADD COLUMN update_requested_at timestamptz;

-- ============ checkin_budget_entries.pix_snapshot ============
ALTER TABLE public.checkin_budget_entries
  ADD COLUMN pix_snapshot jsonb;

-- ============ validate_pix_key trigger (PERMISSIVE) ============
CREATE OR REPLACE FUNCTION public.validate_pix_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chave text;
  v_tipo text;
  v_cpf_clean text;
  v_chave_clean text;
  v_reason text;
  v_would_reject boolean := false;
BEGIN
  v_chave := COALESCE(NEW.chave_pix, '');
  v_tipo := NEW.tipo_chave_pix;
  v_cpf_clean := regexp_replace(COALESCE(NEW.cpf, ''), '\D', '', 'g');

  -- Empty/null
  IF v_chave = '' OR v_tipo IS NULL OR v_tipo = '' THEN
    v_would_reject := true;
    v_reason := 'empty_or_null';
  ELSIF v_tipo NOT IN ('cpf','email','telefone','aleatoria') THEN
    v_would_reject := true;
    v_reason := 'other';
  ELSIF v_tipo = 'aleatoria' THEN
    -- PIX-only policy: random UUID keys are not allowed
    v_would_reject := true;
    v_reason := 'uuid_aleatoria';
  ELSIF v_tipo = 'cpf' THEN
    v_chave_clean := regexp_replace(v_chave, '\D', '', 'g');
    IF length(v_chave_clean) <> 11 OR v_chave_clean <> v_cpf_clean THEN
      v_would_reject := true;
      v_reason := 'cpf_mismatch';
    END IF;
  ELSIF v_tipo = 'email' THEN
    IF v_chave !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      v_would_reject := true;
      v_reason := 'email_invalid';
    END IF;
  ELSIF v_tipo = 'telefone' THEN
    v_chave_clean := regexp_replace(v_chave, '\D', '', 'g');
    IF length(v_chave_clean) NOT BETWEEN 10 AND 13 THEN
      v_would_reject := true;
      v_reason := 'phone_invalid';
    END IF;
  END IF;

  IF v_would_reject THEN
    INSERT INTO public.pix_validation_log (
      profile_id, attempted_chave_pix, attempted_tipo_chave_pix,
      would_reject, rejection_reason, operation, triggered_by_user_id
    ) VALUES (
      NEW.id, NEW.chave_pix, NEW.tipo_chave_pix,
      true, v_reason, TG_OP, auth.uid()
    );
  END IF;

  -- PERMISSIVE: never block
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_pix_key
BEFORE INSERT OR UPDATE OF chave_pix, tipo_chave_pix
ON public.freelancer_profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_pix_key();
