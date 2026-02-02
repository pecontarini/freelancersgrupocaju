-- Update user_has_access_to_loja function to also check profiles.unidade_id
CREATE OR REPLACE FUNCTION public.user_has_access_to_loja(_user_id uuid, _loja_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_stores
        WHERE user_id = _user_id
          AND loja_id = _loja_id
    )
    OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = _user_id
          AND unidade_id = _loja_id
    )
$function$;