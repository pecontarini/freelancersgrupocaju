BEGIN;

-- ============================================================
-- ACL HARDENING: revoke broad access (PUBLIC + explicit roles)
-- Note: Supabase grants EXECUTE directly to anon/authenticated by
-- default on public schema functions, so REVOKE FROM PUBLIC alone
-- is insufficient. Must revoke from each role explicitly.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.validate_pix_key() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peek_pix_magic_link(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_pix_magic_link(text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.peek_pix_magic_link(text) TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.consume_pix_magic_link(text, text, text) TO anon, service_role;

-- ============================================================
-- V-S1: peek_pix_magic_link with server-side PII masking
-- ============================================================

CREATE OR REPLACE FUNCTION public.peek_pix_magic_link(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_queue   record;
  v_profile record;
  v_cpf_clean      text;
  v_tel_clean      text;
  v_chave_raw      text;
  v_cpf_masked     text;
  v_tel_masked     text;
  v_chave_masked   text;
  v_primeiro_nome  text;
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

  IF v_queue.magic_link_expires_at IS NULL
     OR v_queue.magic_link_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_expired');
  END IF;

  IF v_queue.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_revoked');
  END IF;

  SELECT * INTO v_profile
  FROM public.freelancer_profiles
  WHERE id = v_queue.profile_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  v_cpf_clean := regexp_replace(COALESCE(v_profile.cpf, ''), '\D', '', 'g');
  IF length(v_cpf_clean) = 11 THEN
    v_cpf_masked := 'XXX.XXX.XXX-' || substring(v_cpf_clean from 10 for 2);
  ELSE
    v_cpf_masked := 'XXX.XXX.XXX-XX';
  END IF;

  v_tel_clean := regexp_replace(COALESCE(v_profile.telefone, ''), '\D', '', 'g');
  IF length(v_tel_clean) >= 4 THEN
    v_tel_masked := '(XX) XXXXX-XX' || substring(v_tel_clean from length(v_tel_clean) - 1 for 2);
  ELSE
    v_tel_masked := '(XX) XXXXX-XXXX';
  END IF;

  v_chave_raw := COALESCE(v_profile.chave_pix, '');
  IF length(v_chave_raw) >= 4 THEN
    v_chave_masked :=
      substring(v_chave_raw from 1 for 2)
      || repeat('*', greatest(length(v_chave_raw) - 4, 1))
      || substring(v_chave_raw from length(v_chave_raw) - 1 for 2);
  ELSIF length(v_chave_raw) > 0 THEN
    v_chave_masked := repeat('*', length(v_chave_raw));
  ELSE
    v_chave_masked := '';
  END IF;

  v_primeiro_nome := split_part(COALESCE(v_profile.nome_completo, ''), ' ', 1);

  RETURN jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'primeiro_nome', v_primeiro_nome,
      'cpf_masked', v_cpf_masked,
      'telefone_masked', v_tel_masked,
      'chave_pix_masked', v_chave_masked,
      'tipo_chave_pix', v_profile.tipo_chave_pix
    ),
    'expires_at', v_queue.magic_link_expires_at
  );
END;
$fn$;

-- ============================================================
-- V-S2: consume_pix_magic_link with atomic compare-and-swap
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

  UPDATE public.freelancer_profiles
     SET chave_pix = trim(p_new_chave_pix),
         tipo_chave_pix = p_new_tipo_chave_pix,
         updated_at = now()
   WHERE id = v_swap.profile_id;

  RETURN jsonb_build_object(
    'ok', true,
    'queue_id', v_swap.id,
    'profile_id', v_swap.profile_id
  );
END;
$fn$;

-- ============================================================
-- DO $verify$ : enforce expected ACL state intra-transaction
-- ============================================================

DO $verify$
DECLARE
  v_anon_secdef int;
  v_auth_secdef int;
BEGIN
  IF has_function_privilege('authenticated', 'public.validate_pix_key()', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify failed: authenticated still has EXECUTE on validate_pix_key';
  END IF;

  IF has_function_privilege('anon', 'public.validate_pix_key()', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify failed: anon still has EXECUTE on validate_pix_key';
  END IF;

  IF has_function_privilege('authenticated', 'public.peek_pix_magic_link(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify failed: authenticated still has EXECUTE on peek_pix_magic_link';
  END IF;

  IF NOT has_function_privilege('anon', 'public.peek_pix_magic_link(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify failed: anon missing EXECUTE on peek_pix_magic_link';
  END IF;

  IF has_function_privilege('authenticated', 'public.consume_pix_magic_link(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify failed: authenticated still has EXECUTE on consume_pix_magic_link';
  END IF;

  IF NOT has_function_privilege('anon', 'public.consume_pix_magic_link(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify failed: anon missing EXECUTE on consume_pix_magic_link';
  END IF;

  SELECT count(*) INTO v_anon_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prosecdef = true
    AND n.nspname = 'public'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  SELECT count(*) INTO v_auth_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prosecdef = true
    AND n.nspname = 'public'
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');

  IF v_anon_secdef <> 25 THEN
    RAISE EXCEPTION 'verify failed: anon SECDEF executable count = % (expected 25)', v_anon_secdef;
  END IF;

  IF v_auth_secdef <> 23 THEN
    RAISE EXCEPTION 'verify failed: authenticated SECDEF executable count = % (expected 23)', v_auth_secdef;
  END IF;

  RAISE NOTICE 'verify OK: anon=%, authenticated=%', v_anon_secdef, v_auth_secdef;
END;
$verify$;

COMMIT;