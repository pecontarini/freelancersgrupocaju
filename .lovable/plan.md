## Objetivo

Hoje no painel **Configuração Operacional — Holding** existem 3 abas que vivem desconectadas:

1. **Dimensionamento** (`holding_staffing_config`) — define mínimos por dia/turno/setor.
2. **Previsão de Freelancers** (`holding_freelancer_forecast`) — COO cadastra reforços por data.
3. **Diárias & Budget** (`holding_freelancer_rates` + `store_budgets.freelancer_budget`) — diária por setor + botão manual "Gravar como Budget".

O elo fraco: hoje o COO precisa **clicar manualmente** em "Gravar como Budget" e a previsão só conta o que ele cadastrou em datas específicas — não considera o **gap automático** entre o mínimo dimensionado e o efetivo CLT (que já está calculado em `useEffectiveHeadcountBySector`).

A proposta é tornar o cruzamento **automático e fiel**: toda alteração em qualquer um dos 3 inputs (mínimo, efetivo CLT, previsão pontual, diária) recalcula em tempo real o budget de freelancers do mês e grava em `store_budgets`.

---

## Como o cruzamento vai funcionar

Para cada mês × unidade, o sistema calcula a **necessidade total de diárias de freelancer** somando duas fontes:

```text
DIÁRIAS DE GAP (estrutural, recorrente)
  Para cada setor × turno × dia-da-semana do mês:
    gap_pessoas = max(0, mínimo_dimensionado - efetivo_CLT_do_setor)
    dias_no_mês = quantos desse dia-da-semana caem no mês
    diárias_gap[setor] += gap_pessoas × dias_no_mês

DIÁRIAS PONTUAIS (eventos, feriados, reforços)
  Soma direta de holding_freelancer_forecast.freelancer_count
  agrupado por setor.

TOTAL POR SETOR = diárias_gap[setor] + diárias_pontuais[setor]
BUDGET FINAL    = Σ (TOTAL[setor] × diária[setor])
```

A diária por setor continua vindo de `holding_freelancer_rates` (fallback R$ 120 — já existe na regra de negócio).

---

## Mudanças propostas

### 1. Novo hook `useHoldingFreelancerBudgetCalc(unitId, monthYear, brand)`
Arquivo novo: `src/hooks/useHoldingFreelancerBudgetCalc.ts`.

Centraliza o cálculo acima reusando os hooks existentes:
- `useHoldingStaffingConfig` (mínimos)
- `useEffectiveHeadcountBySector` (CLT ativos)
- `useHoldingFreelancerForecast` (pontuais)
- `useHoldingFreelancerRates` (diárias)

Retorna um breakdown por setor + total geral, pronto para a UI.

### 2. Aba "Previsão de Freelancers" — passar a mostrar a visão completa
`HoldingForecastPanel.tsx` ganha, **acima** da lista atual, uma tabela-resumo:

| Setor | Diárias de Gap (estrutural) | Diárias Pontuais | Total Diárias |
|---|---|---|---|
| Garçom | 18 | 4 | 22 |
| Cozinha | 12 | 0 | 12 |
| ... | | | |

A lista atual de previsões pontuais continua igual logo abaixo (nada quebra).

### 3. Aba "Diárias & Budget" — ficar fiel ao cálculo
`HoldingRatesPanel.tsx` muda a tabela "Calculadora de Budget":

- Coluna **Qtd. Prevista** passa a vir do novo hook (gap + pontual), não só do `forecast`.
- Tooltip/legenda explicando o desdobramento (ex.: `22 = 18 gap + 4 pontual`).
- Botão "Gravar como Budget" continua existindo, mas:
  - é executado **automaticamente** via `useEffect` quando o total muda (debounce ~1.5s) — mantém `store_budgets.freelancer_budget` sempre fiel;
  - o botão manual vira "Forçar gravação agora" para o caso de o COO querer salvar imediatamente sem esperar o debounce.

### 4. Indicador no topo do painel Holding
Em `HoldingStaffingPanel.tsx` (logo abaixo da summary bar existente, sem mexer no grid), um chip discreto:

```
Budget previsto deste mês: R$ 12.480,00 · sincronizado há 3s
```

Assim o COO vê em tempo real, sem trocar de aba, o impacto de cada célula que ele edita no dimensionamento.

---

## Detalhes técnicos

**Sem mudanças de schema.** Todas as tabelas já existem e estão sendo usadas:
- `holding_staffing_config` — mínimos por dia/turno
- `holding_freelancer_forecast` — pontuais
- `holding_freelancer_rates` — diária por setor
- `store_budgets.freelancer_budget` — destino final

**Auto-save com guard:** o `useEffect` de gravação automática só dispara quando:
1. nenhuma das queries está em `isLoading` ou `isFetching`;
2. o valor calculado difere do `currentBudget.freelancer_budget` em mais de R$ 0,01;
3. passou o debounce de 1.5s sem novas mudanças.

**Contagem de dias por DOW no mês:** função pura `daysOfWeekInMonth(monthYear)` retornando `Record<0..6, number>` — adicionada no novo hook.

**Cache invalidation:** as mutations já invalidam suas próprias queries; o hook agregador re-renderiza sozinho via TanStack Query.

**Nada do design Liquid Glass atual é alterado** — só novos cards/linhas usando os mesmos tokens (`glass-card`, `tabular-nums`, `text-primary`).

---

## Arquivos afetados

- **novo:** `src/hooks/useHoldingFreelancerBudgetCalc.ts`
- **edit:** `src/components/escalas/holding/HoldingForecastPanel.tsx` (adiciona tabela-resumo no topo)
- **edit:** `src/components/escalas/holding/HoldingRatesPanel.tsx` (qtd. vem do hook agregado + auto-save)
- **edit:** `src/components/escalas/holding/HoldingStaffingPanel.tsx` (chip de budget no topo, ~10 linhas)

Sem migrations, sem edge functions, sem mudanças em RLS.

---

## Pontos a confirmar antes de implementar

1. **Regime 5x2 vs 6x1 no cálculo de gap:** hoje o painel já usa `calcDobras` que converte mínimos em pessoas por regime. Devo aplicar a mesma fórmula ao calcular gap (ou seja, gap = pessoas necessárias por regime − CLT efetivo)? Ou gap puro = mínimo célula − CLT?
2. **Auto-save:** OK gravar automaticamente em `store_budgets`, ou prefere manter manual e só **mostrar** o valor calculado (COO clica para confirmar)?
3. **Diárias pontuais já contam dentro do gap?** Hoje a previsão pontual é cadastrada por data específica. Se o COO já lança 2 garçons num sábado de evento, esses 2 devem ser **adicionais** ao gap estrutural daquele sábado (recomendo sim — assumi isso no plano), ou substituem?