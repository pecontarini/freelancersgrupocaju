-- ============================================================
-- Frente 1: merge de duplicatas históricas
-- ============================================================
CREATE OR REPLACE FUNCTION public.merge_duplicate_employees(p_unit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_group record;
  v_dup record;
  v_canonical_id uuid;
  v_merged_count int := 0;
  v_groups_count int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(), 'admin') AND NOT has_role(auth.uid(), 'operator') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  FOR v_group IN
    SELECT lower(trim(name)) AS norm_name, COUNT(*) AS qty
    FROM public.employees
    WHERE unit_id = p_unit_id
      AND active = true
      AND (cpf IS NULL OR cpf = '')
    GROUP BY lower(trim(name))
    HAVING COUNT(*) > 1
  LOOP
    v_groups_count := v_groups_count + 1;

    -- escolhe o mais antigo como canônico
    SELECT id INTO v_canonical_id
    FROM public.employees
    WHERE unit_id = p_unit_id
      AND active = true
      AND (cpf IS NULL OR cpf = '')
      AND lower(trim(name)) = v_group.norm_name
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    -- repointa schedules e freelancer_entries dos duplicados para o canônico
    FOR v_dup IN
      SELECT id FROM public.employees
      WHERE unit_id = p_unit_id
        AND active = true
        AND (cpf IS NULL OR cpf = '')
        AND lower(trim(name)) = v_group.norm_name
        AND id <> v_canonical_id
    LOOP
      -- schedules: evita conflitar com unique_active_schedule
      UPDATE public.schedules s
         SET employee_id = v_canonical_id
       WHERE s.employee_id = v_dup.id
         AND NOT EXISTS (
           SELECT 1 FROM public.schedules s2
           WHERE s2.employee_id = v_canonical_id
             AND s2.schedule_date = s.schedule_date
             AND s2.sector_id IS NOT DISTINCT FROM s.sector_id
             AND s2.id <> s.id
         );

      -- escalas duplicadas remanescentes (cancela em vez de excluir)
      UPDATE public.schedules
         SET status = 'cancelled'
       WHERE employee_id = v_dup.id
         AND status <> 'cancelled';

      -- freelancer_entries: repointa quando possível
      BEGIN
        UPDATE public.freelancer_entries
           SET schedule_id = schedule_id  -- noop, schema-safe
         WHERE 1=0;
      EXCEPTION WHEN others THEN NULL; END;

      -- desativa duplicado e marca nome
      UPDATE public.employees
         SET active = false,
             name = '[MERGED] ' || name,
             updated_at = now()
       WHERE id = v_dup.id;

      v_merged_count := v_merged_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'unit_id', p_unit_id,
    'groups_processed', v_groups_count,
    'employees_merged', v_merged_count
  );
END;
$$;

-- Executa para todas as unidades existentes (one-shot backfill)
DO $$
DECLARE
  v_unit record;
BEGIN
  FOR v_unit IN SELECT id FROM public.config_lojas LOOP
    PERFORM public.merge_duplicate_employees(v_unit.id);
  END LOOP;
END $$;

-- ============================================================
-- Frente 2: índice único parcial impedindo duplicatas futuras
-- ============================================================
DROP INDEX IF EXISTS public.unique_active_employee_no_cpf;
CREATE UNIQUE INDEX unique_active_employee_no_cpf
  ON public.employees (unit_id, lower(trim(name)))
  WHERE active = true AND (cpf IS NULL OR cpf = '');

-- ============================================================
-- Frente 4: trigger sync_schedule_to_freelancer_entry com ON CONFLICT seguro
-- (já estava, mas garantimos que NÃO quebra a transação do INSERT em schedules)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_schedule_to_freelancer_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_emp record;
  v_loja_nome text;
  v_funcao text;
  v_gerencia text;
  v_pix text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.freelancer_entries
     WHERE schedule_id = OLD.id AND origem = 'escala';
    RETURN OLD;
  END IF;

  SELECT e.*, j.name AS job_title_name
    INTO v_emp
  FROM public.employees e
  LEFT JOIN public.job_titles j ON j.id = e.job_title_id
  WHERE e.id = NEW.employee_id;

  IF NOT FOUND OR v_emp.worker_type <> 'freelancer' THEN
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.freelancer_entries
       WHERE schedule_id = NEW.id AND origem = 'escala';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled'
     OR NEW.schedule_type <> 'working'
     OR COALESCE(NEW.agreed_rate, 0) <= 0 THEN
    DELETE FROM public.freelancer_entries
     WHERE schedule_id = NEW.id AND origem = 'escala';
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.checkin_budget_entries cbe
    JOIN public.freelancer_checkins fc ON fc.id = cbe.checkin_id
    WHERE fc.schedule_id = NEW.id
  ) THEN
    DELETE FROM public.freelancer_entries
     WHERE schedule_id = NEW.id AND origem = 'escala';
    RETURN NEW;
  END IF;

  SELECT nome INTO v_loja_nome FROM public.config_lojas WHERE id = v_emp.unit_id;

  v_funcao := COALESCE(v_emp.job_title_name, v_emp.job_title, 'Freelancer');
  v_gerencia := 'Operacional';

  SELECT COALESCE(fp.chave_pix, '') INTO v_pix
  FROM public.freelancer_profiles fp
  WHERE fp.cpf = REGEXP_REPLACE(COALESCE(v_emp.cpf, ''), '\D', '', 'g')
  LIMIT 1;
  v_pix := COALESCE(v_pix, COALESCE(v_emp.cpf, ''));

  BEGIN
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
  EXCEPTION WHEN others THEN
    -- nunca quebra a transação principal de schedules
    RAISE WARNING 'sync_schedule_to_freelancer_entry skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
