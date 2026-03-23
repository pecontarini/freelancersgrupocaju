
-- Table: checkin_budget_entries (bridge between approved checkins and budget)
CREATE TABLE public.checkin_budget_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id uuid NOT NULL UNIQUE REFERENCES public.freelancer_checkins(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id),
  freelancer_name text NOT NULL,
  cpf text NOT NULL,
  chave_pix text,
  tipo_chave_pix text,
  data_servico date NOT NULL,
  checkin_at timestamptz NOT NULL,
  checkout_at timestamptz,
  valor numeric NOT NULL,
  signed_by uuid NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  approval_id uuid REFERENCES public.checkin_approvals(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkin_budget_entries ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users with access to loja can SELECT
CREATE POLICY "Users can view budget entries for their stores"
  ON public.checkin_budget_entries FOR SELECT TO authenticated
  USING (public.user_has_access_to_loja(auth.uid(), loja_id));

-- No direct INSERT/UPDATE/DELETE — only via DB function
CREATE POLICY "No direct insert"
  ON public.checkin_budget_entries FOR INSERT TO authenticated
  WITH CHECK (false);

-- Function: promote approved checkins to budget entries
CREATE OR REPLACE FUNCTION public.promote_approved_checkins(p_approval_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval record;
  v_count integer := 0;
BEGIN
  -- Get approval info
  SELECT * INTO v_approval FROM checkin_approvals WHERE id = p_approval_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval not found';
  END IF;

  -- Insert approved checkins with confirmed values into budget
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
$$;
