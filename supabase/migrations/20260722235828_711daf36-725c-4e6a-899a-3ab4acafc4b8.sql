
-- 1) Remove política pública que expunha pin_contagem
DROP POLICY IF EXISTS "Anyone can read loja pin_contagem" ON public.config_lojas;

-- Função segura para validar PIN sem expor o valor
CREATE OR REPLACE FUNCTION public.verify_loja_pin(_loja_id uuid, _pin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.config_lojas
    WHERE id = _loja_id
      AND (pin_contagem IS NULL OR pin_contagem = _pin)
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_loja_pin(uuid, text) TO anon, authenticated;

-- 2) Restringe UPDATE anônimo em freelancer_checkins
DROP POLICY IF EXISTS "Public can update checkins for checkout" ON public.freelancer_checkins;

CREATE POLICY "Public can update open checkins"
ON public.freelancer_checkins
FOR UPDATE
TO anon
USING (
  status IN ('open', 'pending_schedule')
  AND valor_status = 'pending'
  AND approved_by IS NULL
  AND valor_approved_by IS NULL
)
WITH CHECK (
  status IN ('open', 'pending_schedule', 'done')
  AND valor_status = 'pending'
  AND approved_by IS NULL
  AND approved_at IS NULL
  AND valor_approved_by IS NULL
  AND valor_approved_at IS NULL
  AND valor_aprovado IS NULL
);
