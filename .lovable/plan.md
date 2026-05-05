
# Painel de Indicadores — Reformulação Profissional

Objetivo: transformar `/painel/metas` em um dashboard executivo interativo (drilldown por clique, filtros vivos, gráficos responsivos) e dar a cada métrica uma visão dedicada e profunda. Foco em UX, hierarquia visual, e dados reais já presentes no projeto.

## Arquitetura geral

```text
/painel/metas
├── Visão Geral (Dashboard Executivo)        ← reformulado
├── NPS / Reclamações                        ← foco 100% reclamações
├── CMV Salmão (marcas Nazo)                 ← foco unitários Nazo
├── CMV Carnes (marcas Caminito)             ← foco unitários Caminito
├── KDS · Tempo de Prato (todas marcas)      ← banco + Drive
├── Conformidade (Auditorias)                ← drilldown back/front
└── Ranking de Lojas                         ← reformulado, multi-métrica
```

Cada view compartilha 4 controles globais: período (mês/3m/6m/YTD), marca, loja, métrica em destaque. Estado fica em URL (`?periodo=&marca=&loja=&metric=`) para deep-link.

---

## 1. Dashboard Executivo (Visão Geral)

Substitui `VisaoGeralCompactView` por uma composição em 4 faixas:

```text
┌─ Faixa 1: KPIs hero (5 cards clicáveis) ──────────────────────┐
│ NPS · CMV Salmão · CMV Carnes · KDS · Conformidade           │
│ cada card: valor, delta vs mês anterior, sparkline 6m,       │
│ chip de status; clicar abre a view dedicada da métrica       │
├─ Faixa 2: Heatmap Loja × Métrica (interativo) ───────────────┤
│ matriz colorida; hover destaca linha+coluna; clique abre     │
│ drawer com detalhe da loja×métrica (série mensal + ações)    │
├─ Faixa 3: 2 colunas ─────────────────────────────────────────┤
│ Ranking compacto (top3/bot3 por métrica selecionada)         │
│ Tendência da rede (linha multi-métrica normalizada 0–100)    │
├─ Faixa 4: Red Flags ativos + Atalhos ────────────────────────┤
│ lista clicável; cada item leva à loja+métrica responsável    │
└──────────────────────────────────────────────────────────────┘
```

Interações chave:
- Clique no KPI → navega para a view da métrica com loja=todas.
- Clique numa célula do heatmap → abre `Sheet` lateral com série 6m, meta vs real, plano de ação vinculado.
- Toggle "Comparar com mês anterior / 3m / YTD" recalcula deltas e cores.
- Filtro de marca propaga para todas as faixas via contexto local.

---

## 2. NPS / Reclamações (foco reclamações)

Reaproveita `useReclamacoes`. Conteúdo:
- 4 KPIs: total mês, graves, NPS-proxy (R$/reclamação), tempo médio de resposta.
- Pareto interativo de temas (clique filtra a lista abaixo).
- Heatmap loja × tema (intensidade = nº reclamações).
- Lista de reclamações com filtros sincronizados (tema, gravidade, loja, período).
- Evolução semanal (linha + barras de graves).

Sem qualquer indicador não-reclamação (vendas, NPS bruto positivo, etc.).

---

## 3. CMV Salmão (Nazo)

Filtro fixo a marcas Nazo (`NZ_*`). Usa `useCMV` / `useCMVAnalytics` / `useCMVContagens`.
- KPI: kg/R$1k vendido (atual, meta 1.55, redflag 1.90), variação semana/mês.
- Tabela de **unitários por item de salmão** (preço médio, kg consumidos, kg vendidos, desvio).
- Gráfico de evolução (linha) por loja Nazo, com seleção múltipla.
- Drilldown por contagem semanal (clica → abre detalhes da contagem).

---

## 4. CMV Carnes (Caminito)

Mesma estrutura do Salmão, fixado em `CP_*`:
- KPI: % desvio sobre transferido (meta 0.6%, redflag 2.0%).
- Tabela de unitários por corte (picanha, ancho, fraldinha…).
- Curva de desvio semanal por loja Caminito.
- Comparativo "transferido × consumido × vendido".

---

## 5. KDS · Tempo de Prato (todas marcas)

- Fonte: tabela do banco (criar hook `useKdsTempoPrato` lendo de `metas_snapshot` + tabela específica se existir; senão, ler CSV do Drive via `sync-google-sheets` já presente).
- KPIs: % black target, tempo médio (s), p95.
- Gráfico de barras por loja (ordenável), com toggle marca.
- Distribuição de tempos (histograma) por loja selecionada.
- Linha de evolução semanal por marca.

Decisão de fonte (banco vs Drive) será confirmada no momento da implementação após inspecionar o schema (`metas_snapshot.kds` já existe; complementaremos com a planilha se houver detalhamento por prato).

---

## 6. Conformidade (Auditorias)

Mesma vibe interativa do executivo, dentro do escopo de auditoria. Usa `useSupervisionAudits` + `useAuditSectorScores`:
- KPIs: nota global rede, evolução vs auditoria anterior, % itens críticos abertos, planos de ação resolvidos.
- Toggle **Back / Front / Geral** que filtra setores.
- Heatmap loja × setor (clique abre a auditoria com itens críticos).
- Linha de evolução das notas por loja (multi-seleção).
- Lista de não-conformidades pendentes com link para o plano de ação.

---

## 7. Ranking de Lojas (reformulado)

Substitui o ranking atual por um ranking executivo:
- Seletor de métrica primária (ou "Score composto" normalizado 0–100 de todas as métricas aplicáveis).
- Tabela com: posição, loja, marca, valor, delta vs mês anterior, status, mini-sparkline 6m.
- Respeita `lojaHasRankingMetric` (— para métricas N/A).
- Botões de exportação (CSV / PNG da matriz).
- Visão "Pódio" no topo (ouro/prata/bronze) por métrica selecionada.

---

## Camada técnica

- Novos componentes:
  - `views/ExecutiveOverviewView.tsx` (substitui o uso atual)
  - `views/NpsReclamacoesView.tsx`
  - `views/CmvSalmaoView.tsx`
  - `views/CmvCarnesView.tsx`
  - `views/KdsTempoPratoView.tsx`
  - `views/ConformidadeView.tsx`
  - `views/RankingView.tsx` (reescrito)
  - `shared/MetricHeatmap.tsx`, `shared/MetricDrawer.tsx`, `shared/PeriodFilter.tsx`, `shared/BrandFilter.tsx`
- Hooks novos:
  - `useKdsTempoPrato` (banco + fallback Drive via edge function existente)
  - `useNpsReclamacoesAggregates` (composição de `useReclamacoes`)
  - `useConformidadeBreakdown` (back/front a partir de `useAuditSectorScores`)
- Roteamento interno de `Metas.tsx` é atualizado para mapear cada `MetaKey` à nova view; o `safeView` para `gerente_unidade` continua respeitado.
- Estado de filtros vive em `useSearchParams` para deep-link e refresh-safe.
- Visual: mantém `vision-glass`, sem emojis em UI (per memory), `lucide-react`, animações Framer Motion suaves; mobile-first com bottom sheet para drawers.
- Sem mudanças em RLS ou tabelas — só consumo. Caso o KDS detalhado exija nova tabela, pediremos confirmação antes de criar migração.

## Fora de escopo (não tocar)

- Nada fora de `/painel/metas` e `src/lib/lojaUtils.ts`.
- `ExecutiveNetworkDashboard.tsx` (usado em outra aba "Rede") permanece intacto.
- Sem alterações em autenticação, perfis, ou outras tabs do portal.

## Entrega faseada (na ordem de implementação)

1. Skeleton dos arquivos de view + roteamento + filtros globais (URL state).
2. Dashboard Executivo (KPIs hero + heatmap + drawer).
3. View NPS/Reclamações.
4. Views CMV Salmão e CMV Carnes.
5. View KDS.
6. View Conformidade (drilldown back/front).
7. Ranking reformulado + exportações.
8. Polimento mobile + microinterações.
