
DROP TRIGGER IF EXISTS trg_validate_pix_key ON public.freelancer_profiles;

CREATE TRIGGER trg_validate_pix_key
AFTER INSERT OR UPDATE OF chave_pix, tipo_chave_pix
ON public.freelancer_profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_pix_key();
