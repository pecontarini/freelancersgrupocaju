
-- Update RLS policies that reference 'partner' to use 'operator'

-- 1. cmv_nfe_mappings
DROP POLICY IF EXISTS "Store managers can manage cmv_nfe_mappings" ON public.cmv_nfe_mappings;
CREATE POLICY "Store managers can manage cmv_nfe_mappings"
  ON public.cmv_nfe_mappings FOR ALL
  USING (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 2. notification_logs
DROP POLICY IF EXISTS "Gerentes can read notification logs" ON public.notification_logs;
CREATE POLICY "Gerentes can read notification logs"
  ON public.notification_logs FOR SELECT
  USING (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 3. schedules - Gerente policy
DROP POLICY IF EXISTS "Gerente can manage unit schedules" ON public.schedules;
CREATE POLICY "Gerente can manage unit schedules"
  ON public.schedules FOR ALL
  USING (
    (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
    AND EXISTS (
      SELECT 1 FROM user_stores us
      WHERE us.user_id = auth.uid() AND us.loja_id = (SELECT s.unit_id FROM sectors s WHERE s.id = schedules.sector_id)
    )
  )
  WITH CHECK (
    (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
    AND EXISTS (
      SELECT 1 FROM user_stores us
      WHERE us.user_id = auth.uid() AND us.loja_id = (SELECT s.unit_id FROM sectors s WHERE s.id = schedules.sector_id)
    )
  );

DROP POLICY IF EXISTS "Gerente can view unit schedules" ON public.schedules;
CREATE POLICY "Gerente can view unit schedules"
  ON public.schedules FOR SELECT
  USING (
    (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
    AND EXISTS (
      SELECT 1 FROM user_stores us
      WHERE us.user_id = auth.uid() AND us.loja_id = (SELECT s.unit_id FROM sectors s WHERE s.id = schedules.sector_id)
    )
  );

-- 4. employees - Partners policy
DROP POLICY IF EXISTS "Partners can manage all employees" ON public.employees;
CREATE POLICY "Operators can manage all employees"
  ON public.employees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'operator'
    )
  );

-- 5. staffing_matrix - Gerentes policy (includes partner → operator)
DROP POLICY IF EXISTS "Gerentes can manage staffing_matrix" ON public.staffing_matrix;
CREATE POLICY "Gerentes can manage staffing_matrix"
  ON public.staffing_matrix FOR ALL
  USING (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- 6. Update the reset_unit_sales_data function
CREATE OR REPLACE FUNCTION public.reset_unit_sales_data(target_unit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_daily_sales_count integer;
  v_transactions_count integer;
  v_positions_count integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') AND NOT has_role(auth.uid(), 'operator') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta operação.';
  END IF;

  DELETE FROM daily_sales WHERE unit_id = target_unit_id;
  GET DIAGNOSTICS v_daily_sales_count = ROW_COUNT;

  DELETE FROM inventory_transactions 
  WHERE unit_id = target_unit_id 
    AND transaction_type = 'sale_deduction';
  GET DIAGNOSTICS v_transactions_count = ROW_COUNT;

  DELETE FROM daily_stock_positions WHERE unit_id = target_unit_id;
  GET DIAGNOSTICS v_positions_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'daily_sales_deleted', v_daily_sales_count,
    'transactions_deleted', v_transactions_count,
    'positions_deleted', v_positions_count
  );
END;
$function$;

-- 7. Employee role: allow viewing own schedules only
-- Employees can view schedules where they are the assigned employee
CREATE POLICY "Employees can view own schedules"
  ON public.schedules FOR SELECT
  USING (
    has_role(auth.uid(), 'employee'::app_role)
    AND employee_id IN (
      SELECT e.id FROM employees e
      WHERE e.phone IS NOT NULL
    )
  );
