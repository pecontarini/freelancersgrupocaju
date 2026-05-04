## Objetivo

Redefinir a métrica NPS no Painel de Metas: o valor armazenado em `metas_snapshot.nps` deixa de ser uma nota 0–100 e passa a representar **R$ por reclamação** (faturamento ÷ nº de reclamações), com faixas distintas para Salão e Delivery.

## Novas faixas

| Tipo | Excelente | Bom | Regular | Red Flag |
|---|---|---|---|---|
| Salão | ≥ R$ 120k | ≥ R$ 95k | ≥ R$ 70k | < R$ 70k |
| Delivery | ≥ R$ 12k | ≥ R$ 10k | ≥ R$ 8k | < R$ 8k |

## Mudanças

### 1. `src/lib/metasUtils.ts`
- Substituir `calcNpsStatus(value)` pela versão com parâmetro `tipo: "salao" | "delivery"` (default `"salao"`) usando os thresholds acima.
- Adicionar `formatNpsDisplay(value)` → `"R$ 311,5k"` / `"R$ 950"`.

### 2. `src/pages/painel/Metas.tsx`
- Atualizar o spec do card "NPS Salão": `meta: 120000`, `redFlag: 70000`, `polarity: "higher"`, sem sufixo de unidade.
- Passar valor formatado para o card (ver item 4).

### 3. `src/components/metas/MetaCard.tsx`
- Aceitar prop opcional `formatValor?: (n: number) => string` e `formatMeta?: (n: number) => string`. Se ausentes, mantém `toLocaleString("pt-BR")` atual. Usar `formatNpsDisplay` apenas no card de NPS.

### 4. `src/components/dashboard/painel-metas/shared/mockLojas.ts`
- Em `METRIC_META.nps`: `meta: 120000`, `redFlag: 70000` (mantém `polarity: "higher"`). Isso recalibra ranking/normalização.
- No `RankingView`, formatar a coluna de valor de NPS via `formatNpsDisplay` (demais métricas seguem como hoje).

### 5. `src/components/metas/RedFlagBanner.tsx`
- Atualizar entrada do array `METRICS` para NPS: `meta: 120000`, `redFlag: 70000` (status segue chamando `calcNpsStatus` — default Salão).

### 6. Seed em `metas_snapshot` (mes_ref `2026-04`)
Os 10 registros atuais têm `nps` entre 68 e 88 (escala antiga). Vou **reescrever via UPDATE** para valores realistas em R$/reclamação, mantendo a hierarquia do ranking e deixando `NZ_GO` em red flag (< 70k). `nps_anterior` recebe variação de ±5–10% para preservar a tendência.

Exemplo (valores aproximados):
```text
NZ_SG  148000 / 138000     CP_AC  92000 / 88000
CJ_SG  132000 / 125000     CP_AS  85000 / 95000  (queda)
NZ_AC  121000 / 110000     NZ_AS  82000 / 78000
CP_AN  118000 / 112000     CJ_AN  74000 / 71000
CP_SG  105000 / 99000      NZ_GO  58000 / 65000  (red flag)
```

## Pontos em aberto (assumi defaults — ajusto se preferir)

1. **Delivery**: hoje `metas_snapshot` só tem `nps` (Salão). Não criarei coluna `nps_delivery` nesta rodada — `formatNpsDisplay` e a sobrecarga `tipo` ficam prontas para quando a coluna existir. Confirme se quer já adicionar `nps_delivery` à tabela.
2. **Histórico (`MetasHistoricoDrawer`)**: a linha de referência da meta passa de 80 para 120000 automaticamente via prop. Tooltip do gráfico também usará `formatNpsDisplay` para o eixo NPS.

Não toco em `VisaoGeralView` (usa fonte separada `nps_dashboard` com média 0–5 vinda de Sheets — semântica diferente).
