
-- 1. freelancer_profiles
CREATE TABLE public.freelancer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text UNIQUE NOT NULL,
  nome_completo text NOT NULL,
  telefone text,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read freelancer_profiles" ON public.freelancer_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can insert freelancer_profiles" ON public.freelancer_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage freelancer_profiles" ON public.freelancer_profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. freelancer_checkins
CREATE TABLE public.freelancer_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL REFERENCES public.freelancer_profiles(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  checkin_at timestamptz NOT NULL DEFAULT now(),
  checkin_selfie_url text NOT NULL,
  checkin_lat numeric,
  checkin_lng numeric,
  checkout_at timestamptz,
  checkout_selfie_url text,
  checkout_lat numeric,
  checkout_lng numeric,
  valor_informado numeric,
  valor_aprovado numeric,
  valor_status text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'open',
  approved_by uuid,
  approved_at timestamptz,
  valor_approved_by uuid,
  valor_approved_at timestamptz,
  rejection_reason text,
  checkin_date date GENERATED ALWAYS AS ((checkin_at AT TIME ZONE 'America/Sao_Paulo')::date) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_unique_daily_checkin ON public.freelancer_checkins (freelancer_id, loja_id, checkin_date);

ALTER TABLE public.freelancer_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert checkins" ON public.freelancer_checkins FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can update checkins for checkout" ON public.freelancer_checkins FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public can read checkins" ON public.freelancer_checkins FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Managers can manage checkins" ON public.freelancer_checkins FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

-- 3. checkin_approvals
CREATE TABLE public.checkin_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  approval_date date NOT NULL,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  pin_hash text,
  checkin_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkin_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read approvals" ON public.checkin_approvals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));
CREATE POLICY "Authenticated can insert approvals" ON public.checkin_approvals FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_has_access_to_loja(auth.uid(), loja_id));

-- 4. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('freelancer-checkin-photos', 'freelancer-checkin-photos', true);

CREATE POLICY "Public read checkin photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'freelancer-checkin-photos');
CREATE POLICY "Public upload checkin photos" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'freelancer-checkin-photos');
