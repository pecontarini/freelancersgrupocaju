
# Painel de Indicadores — redirect + reconstrução completa

## Diagnóstico do que está quebrado

1. **Botão "Painel de Indicadores" não abre `/painel/metas`.** Em `src/pages/Index.tsx`, `handleTabChange("painel")` apenas chama `setActiveTab("painel")` e renderiza inline o componente antigo `PainelMetasTab`. O dashboard executivo novo (`src/pages/painel/Metas.tsx`) nunca é alcançado pelo menu lateral / bottom nav.

2. **O painel novo só lê `metas_snapshot`.** Hoje a tabela tem **10 linhas** (apenas mês 2026-05) populadas pelo `useSyncNpsSheets`. Os dados reais que dão profundidade vivem em outras tabelas que o painel ainda não consome:
   - `reclamacoes` (4 linhas) — base de NPS / temas / gravidade
   - `supervision_audits` (146) e `audit_sector_scores` (86) — Conformidade por setor (back/front), com `pdf_url` da auditoria
   - `metas_snapshot` é só o agregado mensal e KDS/Conformidade ali estão incompletos
   
   Resultado: heatmap, KPIs e drilldown ficam vazios fora de NPS.

3. **Drilldown raso.** `MetricDrawer` mostra meta vs atual e variação MoM, mas não traz histórico, série temporal nem composição (temas de reclamação, scores por setor, evolução de auditoria).

4. **Sem fidelidade às planilhas.** Não há indicação de qual fonte alimenta o quê, data da última sincronização por métrica, nem botões para forçar sync individual.

---

## Plano de execução

### Passo 1 — Redirect do menu para `/painel/metas`
- Em `src/pages/Index.tsx`, no `handleTabChange`, interceptar `tab === "painel"` e chamar `navigate("/painel/metas")` (mesmo padrão usado para `"agenda"`).
- Remover o `case "painel"` de `renderTabContent` e o import de `PainelMetasTab`.
- Validar destaque do menu na nova rota (já passamos `activeTab="painel"` em `Metas.tsx`).

### Passo 2 — Hooks de dados reais (novos)
Criar hooks que vão alimentar todas as views, retornando dados normalizados por loja/mês, com `fetchAllRows` e respeitando RLS:

- `src/hooks/useConformidadeData.ts` — lê `audit_sector_scores` + `supervision_audits`, agrega por `loja_id`, `month_year`, `sector_code` (back/front), retorna média ponderada e série mensal (últimos 6 meses).
- `src/hooks/useReclamacoesData.ts` — lê `reclamacoes`, agrega por loja, fonte (google/ifood/tripadvisor/getin), tema (jsonb), gravidade. Retorna pareto de temas + lista ordenada por gravidade + série temporal.
- `src/hooks/useMetasHistorico.ts` — lê `metas_snapshot` dos últimos 6 meses por loja e métrica, para sparklines no KPI card e linha de evolução no drawer.
- `useMetasSnapshot` continua sendo a fonte do mês corrente (KPIs hero).

Todos os hooks aceitam `restrictToLojaCodigo` (mapeado para `loja_id` via `lojaMapping.ts` quando preciso).

### Passo 3 — Reconectar as views existentes às fontes reais

- **`ExecutiveOverviewView`** (visão geral): adicionar mini-sparkline 6m em cada `MetricKpiCard` usando `useMetasHistorico`, e badge "última atualização" por métrica. Heatmap continua igual.
- **`NpsReclamacoesView`**: trocar mocks por `useReclamacoesData` real → Pareto de temas, heatmap loja×tema, lista de reclamações com `resumo_ia` e flag `is_grave`.
- **`KdsConformidadeView` (modo `conformidade`)**: passar a usar `useConformidadeData`. Adiciona:
  - Toggle Back / Front (sector_code)
  - Bar chart por loja (mês corrente)
  - Linha de evolução 6m da loja selecionada
  - Lista de auditorias recentes com link `pdf_url` clicável
- **`KdsConformidadeView` (modo `kds`)**: manter snapshot agregado + nota explícita "Fonte: Sheets KDS — última sincronização XX". Quando KDS ainda não foi sincronizado, mostrar empty state, não zeros.
- **`CmvDetailView`** (Salmão / Carnes): manter ranking, adicionar série 6m e atalho "Abrir CMV (Unitários)" para análise profunda da loja.
- **`RankingView`** e **`ComparativoView`**: já consomem `metas_snapshot`. Adicionar seletor de mês e export CSV.

### Passo 4 — Drilldown profundo (`MetricDrawer`)
Expandir o drawer em 3 seções:
1. **Resumo**: meta vs atual, delta MoM, status colorido (já existe).
2. **Histórico 6 meses**: line chart via `useMetasHistorico`.
3. **Composição** (depende da métrica):
   - NPS → top 5 temas de reclamação da loja
   - Conformidade → barras por sector_code (back/front) + link `pdf_url` da última auditoria
   - CMV → atalho para CMV unitário daquela loja
   - KDS → empty state se ainda não há detalhe disponível

### Passo 5 — Barra de status de fontes
Acima do conteúdo de `/painel/metas`, transformar o `NpsSyncBar` atual em um `DataSourceStatusBar` mostrando, para cada métrica:
- Última sincronização
- Botão "Sincronizar agora" (NPS já existe; demais ficam desabilitadas com tooltip "Aguardando ingestão de planilha XYZ" enquanto não houver sync automático).

Isso dá transparência total sobre a fidelidade dos dados.

### Passo 6 — Limpeza
- Remover `VisaoGeralCompactView.tsx` e `VisaoGeralView.tsx` (substituídos pelo `ExecutiveOverviewView`).
- Remover `PainelMetasTab` se não tiver mais consumidores.
- Salvar nota em `mem://architecture/painel-indicadores-route` explicando que o Painel de Indicadores vive exclusivamente em `/painel/metas`.

---

## Detalhes técnicos

```text
Fluxo de dados após mudança
───────────────────────────
Sheets (Google) ─► useSyncNpsSheets ─► metas_snapshot ─► useMetasSnapshot ───┐
                                                         useMetasHistorico ──┤
supervision_audits + audit_sector_scores ─► useConformidadeData ─────────────┼─► views /painel/metas
reclamacoes ──────────────────────────────► useReclamacoesData ──────────────┤
(futuro) Sheets KDS ─► nova função sync ─► metas_snapshot.kds ───────────────┘
```

- `fetchAllRows` em todos os hooks para evitar truncamento em 1000.
- Datas como `YYYY-MM` strings (mês de referência).
- `restrictToLojaCodigo` propagado em cada hook via `lojaCodigoFromNome` ↔ `loja_id`.
- Realtime mantido apenas em `metas_snapshot` (já existe).

## Fora de escopo (sugestões depois)
- Funções de sync para KDS e Conformidade vindas de Sheets (depende dos IDs das planilhas).
- Deep-linking via querystring (`?metric=&loja=&periodo=`).
- Export PNG dos gráficos.
