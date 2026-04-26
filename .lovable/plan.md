## Escopo

Arquivo único: `src/components/dashboard/PainelMetasTab.tsx`. Substituir o `<PlaceholderCard name="NPS" />` por um novo componente `NpsView`. Nenhum outro arquivo será tocado.

## Validação prévia de schema (via supabase--read_query)

- `reclamacoes`: possui `loja_id`, `fonte`, `tipo_operacao`, `referencia_mes`, `nota_reclamacao`, `is_grave`, `data_reclamacao`. **Não possui `faturamento`** — portanto o R$/reclamação será derivado de `store_performance_entries`.
- `store_performance_entries`: possui `loja_id`, `entry_date`, `faturamento_salao`, `faturamento_delivery`, `reclamacoes_salao`, `reclamacoes_ifood`. Faturamentos serão **somados** no mês por loja.

## BLOCO 1 — 4 KPI Cards (reutilizando `KpiCard` existente)

1. **Reclamações Salão** — `count(reclamacoes WHERE tipo_operacao='salao')` no mês selecionado, ícone `Store`.
2. **Reclamações Delivery** — `count(reclamacoes WHERE tipo_operacao='delivery')`, ícone `Truck`.
3. **Pior R$/Reclamação** — unidade com menor valor de `SUM(faturamento_salao) / count(reclamacoes salão)` (apenas unidades com pelo menos 1 reclamação salão), exibe nome + valor formatado em R$ (mil/k), ícone `TrendingDown`.
4. **Melhor R$/Reclamação** — unidade com maior valor (mesma regra), ícone `Trophy`.

Cards 3 e 4 usarão uma variante leve (texto principal = nome curto da unidade, helper = R$ formatado), porque `KpiCard` atual aceita só number. Plano: criar um pequeno wrapper inline `KpiUnitCard` no mesmo arquivo, mantendo o visual `glass-card` consistente.

## BLOCO 2 — Ranking por Unidade (shadcn Table dentro de glass-card)

Colunas: `#` | `Unidade` | `Fat. Salão` | `Reclamações` | `R$/Reclamação` | `Faixa`.

- Construção: agregação no frontend cruzando `store_performance_entries` (soma de `faturamento_salao` por `loja_id` no mês) com `reclamacoes` filtradas por `tipo_operacao='salao'` (count por `loja_id`).
- Ordenação: `faturamento_por_reclamacao DESC` (unidades sem reclamações ficam no fim com indicador `—`).
- Faixas via `Badge` (shadcn), faixas exatamente como no briefing:
  - `≥120000` → `EXCELENTE` (variant `default`)
  - `≥95000` → `BOM` (variant `secondary`)
  - `≥70000` → `REGULAR` (variant `outline`)
  - `<70000` → `RED_FLAG` (variant `destructive`)
- Skeleton em loading; mensagem amigável em estado vazio.

## BLOCO 3 — Reclamações por Canal (recharts PieChart)

- Agrupar `reclam` por `fonte` (google/ifood/tripadvisor/getin/manual/sheets), contar.
- `ResponsiveContainer` (h=260) com `PieChart` + `Pie` (paleta consistente com tier colors do arquivo: amber/orange/red/emerald/sky/violet) + `Tooltip` + `Legend` (verticalAlign bottom).
- Wrapper `Card` com `glass-card`.
- Estado vazio: texto "Sem reclamações no mês".

## BLOCO 4 — Evolução Mensal (recharts LineChart)

- Eixo X: últimos 6 meses incluindo o mês selecionado (`shiftMonth(mes, -5)` … `mes`), labels formatadas via `formatMonthPt` (curto: "Mai/25").
- Query única: `supabase.from('reclamacoes').select('referencia_mes, tipo_operacao').in('referencia_mes', last6)`.
- Duas séries: `salao` e `delivery` (counts por mês).
- `LineChart` em `ResponsiveContainer` (h=260), `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, duas `<Line>` (cores: salão = primary coral, delivery = sky-500).

## Queries (React Query, queryKey reativo ao mês)

```ts
// reclam (mês selecionado, com nome da loja para o ranking/KPIs)
useQuery({
  queryKey: ['painel-nps', mes],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('reclamacoes')
      .select('id, loja_id, fonte, tipo_operacao, config_lojas(nome)')
      .eq('referencia_mes', mes);
    if (error) throw error;
    return data ?? [];
  },
});

// performance entries do mês
useQuery({
  queryKey: ['painel-nps-perf', mes],
  queryFn: async () => {
    const { start, end } = monthRange(mes);
    const { data, error } = await supabase
      .from('store_performance_entries')
      .select('loja_id, faturamento_salao, faturamento_delivery, config_lojas(nome)')
      .gte('entry_date', start).lte('entry_date', end);
    if (error) throw error;
    return data ?? [];
  },
});

// histórico 6 meses para o LineChart
useQuery({
  queryKey: ['painel-nps-hist', mes],
  queryFn: async () => {
    const last6 = Array.from({length:6}, (_,i) => shiftMonth(mes, -(5-i)));
    const { data, error } = await supabase
      .from('reclamacoes')
      .select('referencia_mes, tipo_operacao')
      .in('referencia_mes', last6);
    if (error) throw error;
    return { last6, rows: data ?? [] };
  },
});
```

## Estado e seletor de mês

- O `NpsView` terá seu **próprio** `useState<string>(currentMonth())` + seletor de mês (mesmo card de navegação do `VisaoGeral`), garantindo isolamento entre as sub-abas e zero alteração no `VisaoGeral`.

## Imports adicionais (no topo do arquivo)

- `recharts`: `PieChart`, `Pie`, `Cell`, `Tooltip`, `Legend`, `ResponsiveContainer`, `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`.
- `@/components/ui/badge`: `Badge`.
- `lucide-react`: adicionar `Store`, `Truck` (já temos `Trophy`, `TrendingDown`, `MessageCircle`, `ChevronLeft`, `ChevronRight`).

Recharts já é usado em outros arquivos do projeto (`FinancialCharts`, `CostEvolutionChart`, etc.), nenhuma instalação nova é necessária.

## Não alterar

- `VisaoGeral`, `KpiCard`, `PlaceholderCard`, helpers (`monthRange`, `shiftMonth`, `formatMonthPt`, `tierClasses`, etc.) — apenas reutilizar.
- Estrutura do `PainelMetasTab` root e dos `TabsContent` — apenas o conteúdo do `TabsContent value="nps"` muda de `<PlaceholderCard …/>` para `<NpsView />`.
- Nenhum outro arquivo do projeto.
