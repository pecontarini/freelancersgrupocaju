-- 1) Adicionar colunas de origem e referência à escala em freelancer_entries
ALTER TABLE public.freelancer_entries
  ADD COLUMN IF NOT EXISTS schedule_id uuid NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

-- Garantir 1 lançamento por turno escalado (origem='escala')
CREATE UNIQUE INDEX IF NOT EXISTS unique_freelancer_entry_per_schedule
  ON public.freelancer_entries (schedule_id)
  WHERE schedule_id IS NOT NULL AND origem = 'escala';

CREATE INDEX IF NOT EXISTS idx_freelancer_entries_origem ON public.freelancer_entries (origem);

-- 2) Função que sincroniza schedules → freelancer_entries
CREATE OR REPLACE FUNCTION public.sync_schedule_to_freelancer_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp record;
  v_loja_nome text;
  v_funcao text;
  v_gerencia text;
  v_pix text;
  v_cpf_clean text;
BEGIN
  -- DELETE: remover entry de origem 'escala' associado
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.freelancer_entries
     WHERE schedule_id = OLD.id AND origem = 'escala';
    RETURN OLD;
  END IF;

  -- Para INSERT/UPDATE: só processa freelancer working com taxa > 0
  -- Carrega o employee
  SELECT e.*, j.name AS job_title_name
    INTO v_emp
  FROM public.employees e
  LEFT JOIN public.job_titles j ON j.id = e.job_title_id
  WHERE e.id = NEW.employee_id;

  IF NOT FOUND OR v_emp.worker_type <> 'freelancer' THEN
    -- Não é freelancer: se havia entry de escala, limpar (ex: trocou employee)
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.freelancer_entries
       WHERE schedule_id = NEW.id AND origem = 'escala';
    END IF;
    RETURN NEW;
  END IF;

  -- Cancelado ou não-working ou taxa zero: remover entry provisório
  IF NEW.status = 'cancelled'
     OR NEW.schedule_type <> 'working'
     OR COALESCE(NEW.agreed_rate, 0) <= 0 THEN
    DELETE FROM public.freelancer_entries
     WHERE schedule_id = NEW.id AND origem = 'escala';
    RETURN NEW;
  END IF;

  -- Se já existe um checkin_budget_entry promovido para essa escala, não criar provisório
  IF EXISTS (
    SELECT 1 FROM public.checkin_budget_entries cbe
    JOIN public.freelancer_checkins fc ON fc.id = cbe.checkin_id
    WHERE fc.schedule_id = NEW.id
  ) THEN
    DELETE FROM public.freelancer_entries
     WHERE schedule_id = NEW.id AND origem = 'escala';
    RETURN NEW;
  END IF;

  -- Buscar nome da loja
  SELECT nome INTO v_loja_nome FROM public.config_lojas WHERE id = v_emp.unit_id;

  v_funcao := COALESCE(v_emp.job_title_name, v_emp.job_title, 'Freelancer');
  v_gerencia := 'Operacional';
  v_pix := COALESCE(v_emp.cpf, '');
  v_cpf_clean := COALESCE(v_emp.cpf, '');

  -- Tentar enriquecer pelo perfil global
  SELECT COALESCE(fp.chave_pix, '') INTO v_pix
  FROM public.freelancer_profiles fp
  WHERE fp.cpf = REGEXP_REPLACE(COALESCE(v_emp.cpf, ''), '\D', '', 'g')
  LIMIT 1;
  v_pix := COALESCE(v_pix, COALESCE(v_emp.cpf, ''));

  -- Upsert na tabela
  INSERT INTO public.freelancer_entries (
    loja, nome_completo, funcao, gerencia, data_pop, valor,
    cpf, chave_pix, loja_id, schedule_id, origem
  ) VALUES (
    COALESCE(v_loja_nome, ''),
    v_emp.name,
    v_funcao,
    v_gerencia,
    NEW.schedule_date,
    NEW.agreed_rate,
    COALESCE(v_emp.cpf, ''),
    COALESCE(v_pix, COALESCE(v_emp.cpf, '')),
    v_emp.unit_id,
    NEW.id,
    'escala'
  )
  ON CONFLICT (schedule_id) WHERE schedule_id IS NOT NULL AND origem = 'escala'
  DO UPDATE SET
    nome_completo = EXCLUDED.nome_completo,
    funcao = EXCLUDED.funcao,
    data_pop = EXCLUDED.data_pop,
    valor = EXCLUDED.valor,
    cpf = EXCLUDED.cpf,
    chave_pix = EXCLUDED.chave_pix,
    loja = EXCLUDED.loja,
    loja_id = EXCLUDED.loja_id;

  RETURN NEW;
END;
$$;

-- 3) Trigger em schedules
DROP TRIGGER IF EXISTS trg_sync_schedule_to_freelancer_entry ON public.schedules;
CREATE TRIGGER trg_sync_schedule_to_freelancer_entry
AFTER INSERT OR UPDATE OF agreed_rate, schedule_date, status, schedule_type, employee_id OR DELETE
ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.sync_schedule_to_freelancer_entry();

-- 4) Atualizar promote_approved_checkins para limpar entries provisórios
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
  SELECT * INTO v_approval FROM checkin_approvals WHERE id = p_approval_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval not found';
  END IF;

  -- Apaga lançamentos provisórios (origem='escala') das mesmas escalas que serão promovidas
  DELETE FROM public.freelancer_entries fe
  USING public.freelancer_checkins fc
  WHERE fc.id = ANY(v_approval.checkin_ids)
    AND fc.schedule_id IS NOT NULL
    AND fe.schedule_id = fc.schedule_id
    AND fe.origem = 'escala';

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

-- 5) Backfill: criar entries 'escala' para escalas atuais de freelancers ativas, sem checkin promovido
INSERT INTO public.freelancer_entries (
  loja, nome_completo, funcao, gerencia, data_pop, valor,
  cpf, chave_pix, loja_id, schedule_id, origem
)
SELECT
  COALESCE(cl.nome, ''),
  e.name,
  COALESCE(j.name, e.job_title, 'Freelancer'),
  'Operacional',
  s.schedule_date,
  s.agreed_rate,
  COALESCE(e.cpf, ''),
  COALESCE(fp.chave_pix, COALESCE(e.cpf, '')),
  e.unit_id,
  s.id,
  'escala'
FROM public.schedules s
JOIN public.employees e ON e.id = s.employee_id
LEFT JOIN public.job_titles j ON j.id = e.job_title_id
LEFT JOIN public.config_lojas cl ON cl.id = e.unit_id
LEFT JOIN public.freelancer_profiles fp 
  ON fp.cpf = REGEXP_REPLACE(COALESCE(e.cpf, ''), '\D', '', 'g')
WHERE e.worker_type = 'freelancer'
  AND s.status <> 'cancelled'
  AND s.schedule_type = 'working'
  AND COALESCE(s.agreed_rate, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.checkin_budget_entries cbe
    JOIN public.freelancer_checkins fc ON fc.id = cbe.checkin_id
    WHERE fc.schedule_id = s.id
  )
ON CONFLICT (schedule_id) WHERE schedule_id IS NOT NULL AND origem = 'escala'
DO NOTHING;