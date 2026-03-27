

# Plano: Cruzamento Vendas × Contagem de Carnes (Desvio Real)

## Conceito

Adicionar ao módulo de Contagem de Carnes um painel de **Consumo Teórico vs Real** que:
1. Puxa automaticamente as vendas já importadas (`daily_sales` + `cmv_sales_mappings`)
2. Permite ajuste/entrada manual de vendas por item/dia dentro do próprio módulo
3. Compara contra ambos os dados: saídas da Câmara e VAR da Praça (T1-T3)

## Como funciona

```text
┌─────────────────────────────────────────────────┐
│  SEMANA 30/03 → 05/04   │  Status: Aberta       │
├─────────────────────────────────────────────────┤
│  [Câmara] [Praça] [Vendas & Desvio] ← nova tab │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─ Vendas Teóricas (auto) ──────────────────┐  │
│  │ Produto     │ SEG│ TER│ ... │ TOTAL        │  │
│  │ Chorizo 250g│  12│   8│     │    45         │  │
│  │ (via mapeamento cmv_sales_mappings)        │  │
│  └────────────────────────────────────────────┘  │
│                                                 │
│  ┌─ Ajuste Manual ───────────────────────────┐  │
│  │ Campos editáveis por item/dia para        │  │
│  │ corrigir ou adicionar vendas não captadas  │  │
│  └────────────────────────────────────────────┘  │
│                                                 │
│  ┌─ Cruzamento Desvio ──────────────────────┐  │
│  │ Produto      │Consumo│Vendas│Desvio│ %    │  │
│  │              │ Real  │Teór. │      │      │  │
│  │ Chorizo 250g │  48   │  45  │  +3  │6.7%🔴│  │
│  │ Salmão 200g  │  20   │  19  │  +1  │5.3%🟢│  │
│  │                                          │  │
│  │ Consumo Real = Saída câmara OU VAR praça │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Dados

### Nova tabela: `cmv_vendas_ajuste`
Armazena ajustes manuais de vendas por item/dia/semana (complementa `daily_sales`):

```sql
CREATE TABLE cmv_vendas_ajuste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id UUID NOT NULL REFERENCES semanas_cmv(id) ON DELETE CASCADE,
  cmv_item_id UUID NOT NULL REFERENCES cmv_items(id),
  dia TEXT NOT NULL, -- SEG..DOM
  quantidade_manual NUMERIC,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(semana_id, cmv_item_id, dia)
);
-- RLS via JOIN com semanas_cmv (mesmo padrão de cmv_camara/cmv_praca)
-- Trigger de validação de dia (reusa validate_dia_semana)
```

### Leitura automática de vendas
Para cada item de carne, durante a semana:
- Busca `daily_sales` filtrado por `unit_id` e datas da semana
- Cruza com `cmv_sales_mappings` para saber quais pratos consomem cada `cmv_item`
- Calcula: `consumo_teorico = Σ(quantidade_vendida × multiplicador)`

### Cálculo do desvio
```
Consumo Real (Câmara) = total de saídas da semana por item
Consumo Real (Praça)  = Σ(T1 - T3) por item na semana
Consumo Teórico       = vendas_auto + ajuste_manual

Desvio = Consumo Real - Consumo Teórico
Desvio % = (Desvio / Consumo Teórico) × 100
```

Badge: verde se desvio ≤ meta (0,6%), vermelho se acima.

## Componentes

### 1. `src/components/cmv/CMVVendasDesvioGrid.tsx` — Nova tab "Vendas & Desvio"
- Seção 1: **Vendas Automáticas** — tabela read-only mostrando consumo teórico calculado de `daily_sales`
- Seção 2: **Ajuste Manual** — inputs editáveis por item/dia (debounce 800ms, auto-save em `cmv_vendas_ajuste`)
- Seção 3: **Cruzamento** — tabela comparativa com colunas: Item | Consumo Real (Câmara) | Consumo Real (Praça) | Vendas Teóricas | Desvio Câmara | Desvio Praça | %
- Alertas visuais para desvios acima da meta

### 2. Hook `useCMVVendasDesvio` em `useCMVSemanas.ts`
- Query para buscar `daily_sales` da semana/unidade
- Query para buscar `cmv_sales_mappings` ativos
- CRUD para `cmv_vendas_ajuste`
- Cálculo memoizado do cruzamento

### 3. Atualizar `CMVContagemCarnes.tsx`
- Adicionar terceira opção no ToggleGroup: "Vendas & Desvio"
- Renderizar `CMVVendasDesvioGrid` quando selecionado

### 4. Atualizar `CMVDesvioResumo.tsx`
- Incluir desvio real (vs vendas) além do desvio percentual atual

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx.sql` | Criar `cmv_vendas_ajuste` + RLS |
| `src/hooks/useCMVSemanas.ts` | Adicionar hook de vendas/desvio |
| `src/components/cmv/CMVVendasDesvioGrid.tsx` | Criar grid de cruzamento |
| `src/components/cmv/CMVContagemCarnes.tsx` | Adicionar tab "Vendas & Desvio" |
| `src/components/cmv/CMVDesvioResumo.tsx` | Incluir desvio real no resumo |
| `src/components/cmv/index.ts` | Exportar novo componente |

