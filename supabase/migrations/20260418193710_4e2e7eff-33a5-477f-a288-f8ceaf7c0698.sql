-- 1. Adicionar email e avatar_url em profiles (para busca de participantes)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Popular email a partir de auth.users para profiles existentes
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_lower ON public.profiles (lower(full_name));

-- Atualizar trigger handle_new_user para popular email/avatar
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    is_first BOOLEAN;
BEGIN
    SELECT public.is_first_user() INTO is_first;

    INSERT INTO public.profiles (user_id, full_name, email, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email,
      NEW.raw_user_meta_data->>'avatar_url'
    );

    IF is_first THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    END IF;

    RETURN NEW;
END;
$function$;

-- Permitir que usuários autenticados busquem profiles para selecionar participantes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Authenticated users can search profiles for agenda'
  ) THEN
    CREATE POLICY "Authenticated users can search profiles for agenda"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END$$;

-- 2. Converter participantes para JSONB (de text[] para jsonb)
-- Cada item antigo (string de email) vira { email, status: 'pendente' }
ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS participantes_new jsonb DEFAULT '[]'::jsonb;

UPDATE public.agenda_eventos
SET participantes_new = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('email', val, 'status', 'pendente'))
    FROM unnest(participantes) AS val
    WHERE val IS NOT NULL AND length(trim(val)) > 0
  ),
  '[]'::jsonb
)
WHERE participantes IS NOT NULL;

ALTER TABLE public.agenda_eventos DROP COLUMN participantes;
ALTER TABLE public.agenda_eventos RENAME COLUMN participantes_new TO participantes;
ALTER TABLE public.agenda_eventos ALTER COLUMN participantes SET DEFAULT '[]'::jsonb;
ALTER TABLE public.agenda_eventos ALTER COLUMN participantes SET NOT NULL;