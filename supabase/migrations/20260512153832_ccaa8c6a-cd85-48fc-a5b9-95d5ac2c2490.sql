
-- Add new columns
ALTER TABLE public.whatsapp_dispatch_queue
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'wame',
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

-- Update status check constraint
ALTER TABLE public.whatsapp_dispatch_queue
  DROP CONSTRAINT IF EXISTS whatsapp_dispatch_queue_status_check;

ALTER TABLE public.whatsapp_dispatch_queue
  ADD CONSTRAINT whatsapp_dispatch_queue_status_check
  CHECK (status IN ('pending','sent','dispatched','opened','responded','failed','cancelled'));

-- Channel constraint
ALTER TABLE public.whatsapp_dispatch_queue
  ADD CONSTRAINT whatsapp_dispatch_queue_channel_check
  CHECK (channel IN ('wame','n8n'));

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_wa_dispatch_queue_token
  ON public.whatsapp_dispatch_queue (magic_link_token)
  WHERE magic_link_token IS NOT NULL;

-- ============================================================
-- Public RPC: consume magic link token and update PIX
-- ============================================================
CREATE OR REPLACE FUNCTION public.consume_pix_magic_link(
  p_token text,
  p_new_chave_pix text,
  p_new_tipo_chave_pix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue record;
  v_profile_id uuid;
BEGIN
  -- Lookup token (case-sensitive, exact match)
  SELECT *
    INTO v_queue
  FROM public.whatsapp_dispatch_queue
  WHERE magic_link_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_invalid');
  END IF;

  IF v_queue.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_already_consumed');
  END IF;

  IF v_queue.magic_link_expires_at IS NULL
     OR v_queue.magic_link_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_expired');
  END IF;

  IF v_queue.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_revoked');
  END IF;

  v_profile_id := v_queue.profile_id;

  -- Validate inputs
  IF p_new_tipo_chave_pix NOT IN ('cpf','email','telefone') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tipo_invalido');
  END IF;

  IF p_new_chave_pix IS NULL OR length(trim(p_new_chave_pix)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'chave_vazia');
  END IF;

  -- Update profile (passes through validate_pix_key trigger - permissive)
  UPDATE public.freelancer_profiles
     SET tipo_chave_pix = p_new_tipo_chave_pix,
         chave_pix = trim(p_new_chave_pix),
         update_requested_by = NULL,
         update_requested_at = NULL
   WHERE id = v_profile_id;

  -- Mark queue as responded + consumed
  UPDATE public.whatsapp_dispatch_queue
     SET status = 'responded',
         dispatch_responded_at = now(),
         consumed_at = now()
   WHERE id = v_queue.id;

  RETURN jsonb_build_object(
    'ok', true,
    'profile_id', v_profile_id
  );
END;
$$;

-- ============================================================
-- Public RPC: read profile data for magic link page (masked)
-- ============================================================
CREATE OR REPLACE FUNCTION public.peek_pix_magic_link(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue record;
  v_profile record;
BEGIN
  SELECT * INTO v_queue
  FROM public.whatsapp_dispatch_queue
  WHERE magic_link_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_invalid');
  END IF;
  IF v_queue.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_already_consumed');
  END IF;
  IF v_queue.magic_link_expires_at IS NULL OR v_queue.magic_link_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_expired');
  END IF;
  IF v_queue.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_revoked');
  END IF;

  SELECT id, nome_completo, cpf, telefone, tipo_chave_pix, chave_pix
    INTO v_profile
  FROM public.freelancer_profiles
  WHERE id = v_queue.profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_missing');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'nome_completo', v_profile.nome_completo,
      'cpf', v_profile.cpf,
      'telefone', v_profile.telefone,
      'tipo_chave_pix', v_profile.tipo_chave_pix,
      'chave_pix', v_profile.chave_pix
    ),
    'expires_at', v_queue.magic_link_expires_at
  );
END;
$$;

-- Grant execute to anon (public page calls these without auth)
GRANT EXECUTE ON FUNCTION public.consume_pix_magic_link(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peek_pix_magic_link(text) TO anon, authenticated;
