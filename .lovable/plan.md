

# Plano: Módulo CMV Unitários — Contagem de Carnes por Turno

## Resumo

Criar um módulo novo de controle semanal de carnes com dois quadros (Câmara Congelada e Praça/Operação), gestão de semanas, entrada rápida por turno, e resumo de desvios. Tudo integrado na aba CMV existente como uma nova sub-aba.

## Arquitetura de Dados

### 3 novas tabelas no banco

**`semanas_cmv`** — Controle semanal
- `id`, `loja_id` (FK config_lojas), `data_inicio`, `data_fim`, `responsavel`, `status` (aberta/encerrada), `saldo_anterior_json` (JSONB — saldo final transportado da semana anterior), `encerrada_por`, `encerrada_em`, `created_at`
- RLS: admin vê tudo; demais via `user_has_access_to_loja`

**`cmv_camara`** — Câmara Congelada (entrada/saída por dia)
- `id`, `semana_id` (FK semanas_cmv CASCADE), `cmv_item_id` (FK cmv_items), `dia` (SEG..DOM), `entrada`, `saida`
- UNIQUE(semana_id, cmv_item_id, dia)
- Saldo calculado no frontend (encadeado dia a dia), **não** como coluna gerada (pois depende do saldo anterior que vem de JSONB)
- RLS: via JOIN com semanas_cmv.loja_id

**`cmv_praca`** — Praça/Operação (T1/T2/T3 por dia)
- `id`, `semana_id` (FK semanas_cmv CASCADE), `cmv_item_id` (FK cmv_items), `dia` (SEG..DOM), `t1_abertura`, `t2_almoco`, `t3_fechamento`, `turno_encerrado_em`
- UNIQUE(semana_id, cmv_item_id, dia)
- VAR = T1 - T3 calculado no frontend
- RLS: via JOIN com semanas_cmv.loja_id

> **Nota**: Não usaremos `GENERATED ALWAYS AS` pois o saldo da câmara é encadeado (depende do dia anterior) e o esquema sugerido com saldo_anterior por linha não funciona para cálculo em cascata. O frontend calcula e exibe.

### Migration SQL (1 migration)

```sql
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

-- Validation trigger for status
CREATE OR REPLACE FUNCTION validate_semana_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('aberta', 'encerrada') THEN
    RAISE EXCEPTION 'Status inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;
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

-- Shared dia validation function
CREATE OR REPLACE FUNCTION validate_dia_semana()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.dia NOT IN ('SEG','TER','QUA','QUI','SEX','SAB','DOM') THEN
    RAISE EXCEPTION 'Dia inválido: %', NEW.dia;
  END IF;
  RETURN NEW;
END; $$;

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
```

## Componentes Novos

### 1. `src/hooks/useCMVSemanas.ts`
- Hook para CRUD de `semanas_cmv` (listar por loja, criar, encerrar)
- Hook para CRUD de `cmv_camara` (upsert por semana/item/dia)
- Hook para CRUD de `cmv_praca` (upsert por semana/item/dia)
- Lógica de encerramento: salvar saldo final da câmara como `saldo_anterior_json` da próxima semana

### 2. `src/components/cmv/CMVContagemCarnes.tsx` — Componente principal
- Toggle entre **Câmara Congelada** e **Praça / Operação** (usando ToggleGroup existente)
- Barra de contexto semanal no topo: período, responsável, status
- Renderiza o quadro ativo

### 3. `src/components/cmv/CMVCamaraGrid.tsx` — Quadro Câmara Congelada
- Tabela: linhas = 18 produtos, colunas = SEG a DOM (Entrada / Saída / Saldo)
- Saldo encadeado calculado no frontend
- Saldo < 0: célula vermelha + AlertTriangle
- % Desvio semanal com badge verde/vermelho (meta 0,6%)
- Inputs inline para entrada/saída, debounce 800ms, auto-save via upsert

### 4. `src/components/cmv/CMVPracaGrid.tsx` — Quadro Praça / Operação
- Tabela: linhas = 18 produtos, colunas = SEG a DOM (T1 / T2 / T3 / VAR)
- VAR = T1 - T3, calculado automaticamente
- VAR < 0: alerta visual
- Ao preencher T2, referência do T1 visível; ao preencher T3, referência do T2
- Debounce 800ms, auto-save

### 5. `src/components/cmv/CMVTurnoEntryModal.tsx` — Entrada Rápida Mobile
- Botão na interface abre Sheet/Modal
- Seletor de dia (default hoje) + turno (T1/T2/T3)
- Lista dos 18 produtos com campo numérico grande (min-h-11)
- Referência do turno anterior visível ao lado
- UN = integer only, KG = decimal
- Auto-save debounce 800ms por produto
- Progresso "5/18 preenchidos"
- Botão "Finalizar Turno" → registra timestamp

### 6. `src/components/cmv/CMVDesvioResumo.tsx` — Resumo de Desvio
- Card compacto no rodapé da semana
- Câmara: % desvio + badge 🟢/🔴
- Praça: % desvio + badge 🟢/🔴
- Top 3 desvios por produto

## Integração na Aba CMV

No `CMVTab.tsx`, dentro do `TabsContent value="operacional"`:
- Adicionar `<CMVContagemCarnes />` abaixo do `CMVLiveStockCard` e antes do `CMVDailyCountForm`
- Manter tudo que já existe intacto

## Validações

| Campo | Regra |
|-------|-------|
| Entrada/Saída/T1/T2/T3 | Numero >= 0 |
| UN | Somente inteiro |
| KG | Decimal permitido |
| Campo vazio | null (não zero) |
| Saldo câmara < 0 | Alerta visual, sem bloqueio |
| VAR praça < 0 | Alerta visual, sem bloqueio |
| Encerrar com campos vazios | Warning, sem bloqueio |

## Arquivos Modificados/Criados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx.sql` | Criar 3 tabelas + RLS + triggers |
| `src/hooks/useCMVSemanas.ts` | Criar hooks de dados |
| `src/components/cmv/CMVContagemCarnes.tsx` | Criar componente principal |
| `src/components/cmv/CMVCamaraGrid.tsx` | Criar quadro câmara |
| `src/components/cmv/CMVPracaGrid.tsx` | Criar quadro praça |
| `src/components/cmv/CMVTurnoEntryModal.tsx` | Criar modal entrada rápida |
| `src/components/cmv/CMVDesvioResumo.tsx` | Criar resumo desvios |
| `src/components/cmv/index.ts` | Exportar novos componentes |
| `src/components/dashboard/CMVTab.tsx` | Integrar CMVContagemCarnes na aba operacional |

