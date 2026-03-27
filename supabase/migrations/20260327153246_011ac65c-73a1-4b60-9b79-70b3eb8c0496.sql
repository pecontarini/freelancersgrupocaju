
-- cmv_vendas_ajuste: manual sales adjustments per item/day/week
CREATE TABLE cmv_vendas_ajuste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id UUID NOT NULL REFERENCES semanas_cmv(id) ON DELETE CASCADE,
  cmv_item_id UUID NOT NULL REFERENCES cmv_items(id),
  dia TEXT NOT NULL,
  quantidade_manual NUMERIC,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(semana_id, cmv_item_id, dia)
);

-- Reuse dia validation trigger
CREATE TRIGGER trg_validate_vendas_ajuste_dia
  BEFORE INSERT OR UPDATE ON cmv_vendas_ajuste
  FOR EACH ROW EXECUTE FUNCTION validate_dia_semana();

-- RLS
ALTER TABLE cmv_vendas_ajuste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_vendas_ajuste" ON cmv_vendas_ajuste FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM semanas_cmv s WHERE s.id = semana_id
  AND (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), s.loja_id))));

CREATE POLICY "insert_vendas_ajuste" ON cmv_vendas_ajuste FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM semanas_cmv s WHERE s.id = semana_id
  AND (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), s.loja_id))));

CREATE POLICY "update_vendas_ajuste" ON cmv_vendas_ajuste FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM semanas_cmv s WHERE s.id = semana_id
  AND (has_role(auth.uid(), 'admin') OR user_has_access_to_loja(auth.uid(), s.loja_id))));
