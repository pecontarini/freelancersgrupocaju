-- ============================================================
-- 1. HOLDING_STAFFING_CONFIG (F1 + F4) com month_year
-- ============================================================
CREATE TABLE public.holding_staffing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  brand text NOT NULL,
  sector_key text NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('almoco','jantar')),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  month_year text NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  required_count integer NOT NULL DEFAULT 0 CHECK (required_count >= 0),
  extras_count integer NOT NULL DEFAULT 0 CHECK (extras_count >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (unit_id, sector_key, shift_type, day_of_week, month_year)
);

CREATE INDEX idx_hsc_unit ON public.holding_staffing_config(unit_id);
CREATE INDEX idx_hsc_brand ON public.holding_staffing_config(brand);
CREATE INDEX idx_hsc_month ON public.holding_staffing_config(month_year);

ALTER TABLE public.holding_staffing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on holding_staffing_config"
  ON public.holding_staffing_config FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators read own unit holding_staffing_config"
  ON public.holding_staffing_config FOR SELECT
  USING (user_has_access_to_loja(auth.uid(), unit_id));

CREATE TRIGGER trg_hsc_updated_at
  BEFORE UPDATE ON public.holding_staffing_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. HOLDING_FREELANCER_FORECAST (F2)
-- ============================================================
CREATE TABLE public.holding_freelancer_forecast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  brand text NOT NULL,
  forecast_date date NOT NULL,
  sector_key text NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('almoco','jantar')),
  freelancer_count integer NOT NULL DEFAULT 0 CHECK (freelancer_count >= 0),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (unit_id, forecast_date, sector_key, shift_type)
);

CREATE INDEX idx_hff_unit_date ON public.holding_freelancer_forecast(unit_id, forecast_date);
CREATE INDEX idx_hff_brand ON public.holding_freelancer_forecast(brand);

ALTER TABLE public.holding_freelancer_forecast ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on holding_freelancer_forecast"
  ON public.holding_freelancer_forecast FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators read own unit holding_freelancer_forecast"
  ON public.holding_freelancer_forecast FOR SELECT
  USING (user_has_access_to_loja(auth.uid(), unit_id));

CREATE TRIGGER trg_hff_updated_at
  BEFORE UPDATE ON public.holding_freelancer_forecast
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. HOLDING_FREELANCER_RATES (F3)
-- ============================================================
CREATE TABLE public.holding_freelancer_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  brand text NOT NULL,
  sector_key text NOT NULL,
  daily_rate numeric(10,2) NOT NULL DEFAULT 120.00 CHECK (daily_rate >= 0),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (unit_id, sector_key)
);

CREATE INDEX idx_hfr_unit ON public.holding_freelancer_rates(unit_id);
CREATE INDEX idx_hfr_brand ON public.holding_freelancer_rates(brand);

ALTER TABLE public.holding_freelancer_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on holding_freelancer_rates"
  ON public.holding_freelancer_rates FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators read own unit holding_freelancer_rates"
  ON public.holding_freelancer_rates FOR SELECT
  USING (user_has_access_to_loja(auth.uid(), unit_id));

CREATE TRIGGER trg_hfr_updated_at
  BEFORE UPDATE ON public.holding_freelancer_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. TRIGGER DE ESPELHAMENTO holding_staffing_config → staffing_matrix
-- com mapa sector_key → nome legível
-- ============================================================
CREATE OR REPLACE FUNCTION public.holding_sector_label(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_key
    WHEN 'chefe_subchefe_salao' THEN 'Chefe/Subchefe de Salão'
    WHEN 'garcom' THEN 'Garçom'
    WHEN 'cumin' THEN 'Cumin'
    WHEN 'hostess' THEN 'Hostess'
    WHEN 'caixa_delivery' THEN 'Caixa/Delivery'
    WHEN 'parrilla' THEN 'Parrilla'
    WHEN 'cozinha' THEN 'Cozinha'
    WHEN 'bar' THEN 'Bar'
    WHEN 'servicos_gerais_salao_bar' THEN 'Serviços Gerais Salão/Bar'
    WHEN 'producao' THEN 'Produção'
    WHEN 'sushi' THEN 'Sushi'
    ELSE p_key
  END;
$$;

CREATE OR REPLACE FUNCTION public.mirror_holding_to_staffing_matrix()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sector_id uuid;
  v_sector_name text;
  v_current_month text;
BEGIN
  v_current_month := to_char(CURRENT_DATE, 'YYYY-MM');

  IF TG_OP = 'DELETE' THEN
    v_sector_name := public.holding_sector_label(OLD.sector_key);
    SELECT id INTO v_sector_id
    FROM sectors
    WHERE unit_id = OLD.unit_id AND name = v_sector_name
    LIMIT 1;

    IF v_sector_id IS NOT NULL AND OLD.month_year = v_current_month THEN
      DELETE FROM staffing_matrix
      WHERE sector_id = v_sector_id
        AND day_of_week = OLD.day_of_week
        AND shift_type = OLD.shift_type;
    END IF;
    RETURN OLD;
  END IF;

  -- Apenas espelha o mês corrente para o editor dos gerentes
  IF NEW.month_year <> v_current_month THEN
    RETURN NEW;
  END IF;

  v_sector_name := public.holding_sector_label(NEW.sector_key);

  SELECT id INTO v_sector_id
  FROM sectors
  WHERE unit_id = NEW.unit_id AND name = v_sector_name
  LIMIT 1;

  IF v_sector_id IS NULL THEN
    INSERT INTO sectors (unit_id, name)
    VALUES (NEW.unit_id, v_sector_name)
    RETURNING id INTO v_sector_id;
  END IF;

  INSERT INTO staffing_matrix (sector_id, day_of_week, shift_type, required_count, extras_count, updated_at)
  VALUES (v_sector_id, NEW.day_of_week, NEW.shift_type, NEW.required_count, NEW.extras_count, now())
  ON CONFLICT (sector_id, day_of_week, shift_type)
  DO UPDATE SET
    required_count = EXCLUDED.required_count,
    extras_count = EXCLUDED.extras_count,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mirror_holding_staffing
  AFTER INSERT OR UPDATE OR DELETE ON public.holding_staffing_config
  FOR EACH ROW EXECUTE FUNCTION public.mirror_holding_to_staffing_matrix();