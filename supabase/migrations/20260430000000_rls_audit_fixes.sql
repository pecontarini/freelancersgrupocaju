-- Migration: RLS Audit Fixes
-- Date: 2026-04-30
-- Fixes identified in security audit:
--   1. employees         — SELECT vazava dados de todas as unidades
--   2. schedule_attendance — todas as 4 operações sem filtro de unidade
--   3. freelancer_checkins — SELECT permitia leitura anon de todos os registros
--   4. sectors           — SELECT sem filtro de unidade
--   5. job_titles        — SELECT sem filtro de unidade
--   6. sector_job_titles — SELECT sem filtro de unidade
--   7. staffing_matrix   — SELECT aberto + gerente/operator sem filtro de unidade
--   8. notification_logs — gerentes viam logs de todas as unidades
--   9. audit_upload_logs — gerentes não conseguiam ver logs da própria loja

BEGIN;

-- ============================================================
-- 1. employees — restringir SELECT à própria unidade
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;

CREATE POLICY "Users can view employees of their units"
ON public.employees FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR user_has_access_to_loja(auth.uid(), unit_id)
);

-- Operator (antes "partner") podia gerenciar funcionários de QUALQUER unidade
DROP POLICY IF EXISTS "Operators can manage all employees" ON public.employees;

CREATE POLICY "Operators can manage employees of their units"
ON public.employees FOR ALL
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND user_has_access_to_loja(auth.uid(), unit_id)
)
WITH CHECK (
  has_role(auth.uid(), 'operator'::app_role)
  AND user_has_access_to_loja(auth.uid(), unit_id)
);

-- ============================================================
-- 2. schedule_attendance — isolar por unidade via cadeia
--    schedule_attendance.schedule_id → schedules.sector_id → sectors.unit_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON public.schedule_attendance;
DROP POLICY IF EXISTS "Authenticated users can insert attendance" ON public.schedule_attendance;
DROP POLICY IF EXISTS "Authenticated users can update attendance" ON public.schedule_attendance;
DROP POLICY IF EXISTS "Authenticated users can delete attendance" ON public.schedule_attendance;

CREATE POLICY "Users can view attendance of their units"
ON public.schedule_attendance FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.schedules s
    JOIN public.sectors sec ON sec.id = s.sector_id
    WHERE s.id = schedule_attendance.schedule_id
      AND user_has_access_to_loja(auth.uid(), sec.unit_id)
  )
);

CREATE POLICY "Users can insert attendance of their units"
ON public.schedule_attendance FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.schedules s
    JOIN public.sectors sec ON sec.id = s.sector_id
    WHERE s.id = schedule_attendance.schedule_id
      AND user_has_access_to_loja(auth.uid(), sec.unit_id)
  )
);

CREATE POLICY "Users can update attendance of their units"
ON public.schedule_attendance FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.schedules s
    JOIN public.sectors sec ON sec.id = s.sector_id
    WHERE s.id = schedule_attendance.schedule_id
      AND user_has_access_to_loja(auth.uid(), sec.unit_id)
  )
);

CREATE POLICY "Users can delete attendance of their units"
ON public.schedule_attendance FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.schedules s
    JOIN public.sectors sec ON sec.id = s.sector_id
    WHERE s.id = schedule_attendance.schedule_id
      AND user_has_access_to_loja(auth.uid(), sec.unit_id)
  )
);

-- ============================================================
-- 3. freelancer_checkins — remover SELECT anon (todos os registros expostos)
--    INSERT e UPDATE anon são mantidos (necessários para o fluxo de check-in/out)
--    O frontend deve cachear o checkin_id retornado pelo INSERT para o checkout
-- ============================================================
DROP POLICY IF EXISTS "Public can read checkins" ON public.freelancer_checkins;

CREATE POLICY "Authenticated can read checkins"
ON public.freelancer_checkins FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR user_has_access_to_loja(auth.uid(), loja_id)
);

-- ============================================================
-- 4. sectors — restringir SELECT à própria unidade
-- ============================================================
DROP POLICY IF EXISTS "Anyone authenticated can view sectors" ON public.sectors;

CREATE POLICY "Users can view sectors of their units"
ON public.sectors FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR user_has_access_to_loja(auth.uid(), unit_id)
);

-- ============================================================
-- 5. job_titles — restringir SELECT à própria unidade
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view job_titles" ON public.job_titles;

CREATE POLICY "Users can view job_titles of their units"
ON public.job_titles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR user_has_access_to_loja(auth.uid(), unit_id)
);

-- ============================================================
-- 6. sector_job_titles — restringir SELECT via cadeia sectors.unit_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view sector_job_titles" ON public.sector_job_titles;

CREATE POLICY "Users can view sector_job_titles of their units"
ON public.sector_job_titles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.sectors s
    WHERE s.id = sector_job_titles.sector_id
      AND user_has_access_to_loja(auth.uid(), s.unit_id)
  )
);

-- ============================================================
-- 7. staffing_matrix — restringir SELECT + corrigir gerente/operator
-- ============================================================
DROP POLICY IF EXISTS "Anyone authenticated can view staffing_matrix" ON public.staffing_matrix;
DROP POLICY IF EXISTS "Gerentes can manage staffing_matrix" ON public.staffing_matrix;

CREATE POLICY "Users can view staffing_matrix of their units"
ON public.staffing_matrix FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.sectors s
    WHERE s.id = staffing_matrix.sector_id
      AND user_has_access_to_loja(auth.uid(), s.unit_id)
  )
);

CREATE POLICY "Gerentes can manage staffing_matrix of their units"
ON public.staffing_matrix FOR ALL
USING (
  (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.sectors s
    WHERE s.id = staffing_matrix.sector_id
      AND user_has_access_to_loja(auth.uid(), s.unit_id)
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.sectors s
    WHERE s.id = staffing_matrix.sector_id
      AND user_has_access_to_loja(auth.uid(), s.unit_id)
  )
);

-- ============================================================
-- 8. notification_logs — restringir gerentes à própria unidade
--    Cadeia: notification_logs.schedule_id → schedules.sector_id → sectors.unit_id
-- ============================================================
DROP POLICY IF EXISTS "Gerentes can read notification logs" ON public.notification_logs;

CREATE POLICY "Gerentes can read notification logs of their units"
ON public.notification_logs FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'gerente_unidade'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.schedules s
      JOIN public.sectors sec ON sec.id = s.sector_id
      WHERE s.id = notification_logs.schedule_id
        AND user_has_access_to_loja(auth.uid(), sec.unit_id)
    )
  )
);

-- ============================================================
-- 9. audit_upload_logs — permitir gerentes ver logs da própria loja
-- ============================================================
CREATE POLICY "Gerentes can view their store audit upload logs"
ON public.audit_upload_logs FOR SELECT
TO authenticated
USING (
  user_has_access_to_loja(auth.uid(), loja_id)
);

COMMIT;
