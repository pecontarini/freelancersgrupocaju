BEGIN;

CREATE OR REPLACE FUNCTION public.consume_pix_magic_link(
  p_token text,
  p_new_chave_pix text,
  p_new_tipo_chave_pix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_swap     record;
  v_queue    record;
BEGIN
  IF p_new_tipo_chave_pix NOT IN ('cpf','email','telefone') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tipo_invalido');
  END IF;

  IF p_new_chave_pix IS NULL OR length(trim(p_new_chave_pix)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'chave_vazia');
  END IF;

  UPDATE public.whatsapp_dispatch_queue
     SET consumed_at = now(),
         status = 'responded',
         dispatch_responded_at = COALESCE(dispatch_responded_at, now())
   WHERE magic_link_token = p_token
     AND consumed_at IS NULL
     AND magic_link_expires_at IS NOT NULL
     AND magic_link_expires_at >= now()
     AND status <> 'cancelled'
   RETURNING id, profile_id, magic_link_expires_at
     INTO v_swap;

  IF NOT FOUND THEN
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

    IF v_queue.status = 'cancelled' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'token_revoked');
    END IF;

    IF v_queue.magic_link_expires_at IS NULL
       OR v_queue.magic_link_expires_at < now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'token_expired');
    END IF;

    RETURN jsonb_build_object('ok', false, 'error', 'token_invalid');
  END IF;

  -- Apply update (passes through validate_pix_key trigger - permissive)
  UPDATE public.freelancer_profiles
     SET chave_pix = trim(p_new_chave_pix),
         tipo_chave_pix = p_new_tipo_chave_pix
   WHERE id = v_swap.profile_id;

  RETURN jsonb_build_object(
    'ok', true,
    'queue_id', v_swap.id,
    'profile_id', v_swap.profile_id
  );
END;
$fn$;

-- Verify ACL state preserved (not regressed by CREATE OR REPLACE)
DO $verify$
BEGIN
  IF has_function_privilege('authenticated', 'public.consume_pix_magic_link(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify failed: authenticated regained EXECUTE on consume_pix_magic_link';
  END IF;
  IF NOT has_function_privilege('anon', 'public.consume_pix_magic_link(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify failed: anon lost EXECUTE on consume_pix_magic_link';
  END IF;
  RAISE NOTICE 'verify OK';
END;
$verify$;

COMMIT;