
-- Shared dia validation function (must be created BEFORE triggers that reference it)
CREATE OR REPLACE FUNCTION validate_dia_semana()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.dia NOT IN ('SEG','TER','QUA','QUI','SEX','SAB','DOM') THEN
    RAISE EXCEPTION 'Dia inválido: %', NEW.dia;
  END IF;
  RETURN NEW;
END; $$;

-- Validation trigger for status
CREATE OR REPLACE FUNCTION validate_semana_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('aberta', 'encerrada') THEN
    RAISE EXCEPTION 'Status inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

-- semanas_cmv
CREATE TABLE semanas_cmv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES config_lojas(id),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  responsavel TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  saldo_anterior_json JSONB DEFAULT '{}'::jsonb,
  encerrada_por UUID REFERENCES auth.users(id),
  encerrada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(loja_id, data_inicio)
);

CREATE TRIGGER trg_validate_semana_status
  BEFORE INSERT OR UPDATE ON semanas_cmv
  FOR EACH ROW EXECUTE FUNCTION validate_semana_status();

-- cmv_camara
CREATE TABLE cmv_camara (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id UUID NOT NULL REFERENCES semanas_cmv(id) ON DELETE CASCADE,
  cmv_item_id UUID NOT NULL REFERENCES cmv_items(id),
  dia TEXT NOT NULL,
  entrada NUMERIC,
  saida NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(semana_id, cmv_item_id, dia)
);

CREATE TRIGGER trg_validate_camara_dia BEFORE INSERT OR UPDATE ON cmv_camara
  FOR EACH ROW EXECUTE FUNCTION validate_dia_semana();

CREATE TRIGGER trg_update_camara_updated_at BEFORE UPDATE ON cmv_camara
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- cmv_praca
CREATE TABLE cmv_praca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id UUID NOT NULL REFERENCES semanas_cmv(id) ON DELETE CASCADE,
  cmv_item_id UUID NOT NULL REFERENCES cmv_items(id),
  dia TEXT NOT NULL,
  t1_abertura NUMERIC,
  t2_almoco NUMERIC,
  t3_fechamento NUMERIC,
  turno_encerrado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(semana_id, cmv_item_id, dia)
);

CREATE TRIGGER trg_validate_praca_dia BEFORE INSERT OR UPDATE ON cmv_praca
  FOR EACH ROW EXECUTE FUNCTION validate_dia_semana();

CREATE TRIGGER trg_update_praca_updated_at BEFORE UPDATE ON cmv_praca
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE semanas_cmv ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmv_camara ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmv_praca ENABLE ROW LEVEL SECURITY;

-- semanas_cmv policies
CREATE POLICY "select_semanas" ON semanas_cmv FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "insert_semanas" ON semanas_cmv FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), loja_id));

CREATE POLICY "update_semanas" ON semanas_cmv FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), loja_id));

-- cmv_camara policies (via JOIN)
CREATE POLICY "select_camara" ON cmv_camara FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM semanas_cmv s WHERE s.id = semana_id
  AND (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), s.loja_id))));

CREATE POLICY "insert_camara" ON cmv_camara FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM semanas_cmv s WHERE s.id = semana_id
  AND (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), s.loja_id))));

CREATE POLICY "update_camara" ON cmv_camara FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM semanas_cmv s WHERE s.id = semana_id
  AND (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), s.loja_id))));

-- cmv_praca policies (via JOIN)
CREATE POLICY "select_praca" ON cmv_praca FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM semanas_cmv s WHERE s.id = semana_id
  AND (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), s.loja_id))));

CREATE POLICY "insert_praca" ON cmv_praca FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM semanas_cmv s WHERE s.id = semana_id
  AND (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), s.loja_id))));

CREATE POLICY "update_praca" ON cmv_praca FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM semanas_cmv s WHERE s.id = semana_id
  AND (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), s.loja_id))));
