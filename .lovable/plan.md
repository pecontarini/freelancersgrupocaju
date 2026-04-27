## Objetivo

Reformular o **Painel de Metas** para se aproximar do mockup HTML enviado: navegação lateral por indicador (uma "página" por meta), dashboard executivo com mapa de calor + ranking entre lojas, KPIs por unidade e — quando o usuário acessa uma meta específica — uma seção comparativa dos **últimos 6 meses limitada à loja do usuário** (mês atual vs. melhor mês vs. pior mês).

Mantém-se intacto todo o motor de importação (Sheets, NFe, manual, etc.) — só muda a camada de visualização.

## Arquitetura nova

```text
PainelMetasTab
├─ Sidebar interna (lista de "metas" — atual: tabs no topo)
│   ├─ Visão Geral (Dashboard Executivo)
│   ├─ NPS & Reclamações
│   ├─ CMV Salmão
│   ├─ CMV Carnes
│   ├─ KDS · Tempo de Prato
│   ├─ Conformidade
│   ├─ Red Flag
│   └─ Planos de Ação
│   (Holding/Diário só p/ admin)
│
├─ Header de página (título + período + ação IA opcional)
│
└─ Conteúdo da meta selecionada
     ├─ Bloco A: KPIs por loja (rede inteira, 4 cards)
     ├─ Bloco B: Ranking comparativo entre lojas (sortable)
     ├─ Bloco C: Gráficos interativos do mês (recharts)
     └─ Bloco D — NOVO: "Sua Loja · Últimos 6 meses"
            • aparece SOMENTE em páginas de meta individual
            • limitado à `useUnidade().effectiveUnidadeId`
            • mostra: valor mês atual + melhor mês + pior mês + sparkline
```

## Mudanças por arquivo

### 1. `src/components/dashboard/PainelMetasTab.tsx` — refatorar root
- Substituir `<Tabs>` horizontal por layout 2 colunas: **sidebar interna** (esquerda, ~220px desktop / drawer no mobile) + **conteúdo** (direita).
- Sidebar usa `glass-card` com lista vertical agrupada ("Visão Geral", "Indicadores", "Gestão"), cada item com ícone `lucide-react` colorido (sem emoji), label, e um dot de status quando há red flag ativa.
- No mobile, sidebar vira `Sheet` aberto via botão "Metas ▾" no topo do header.
- Estado da meta atual via `useState<MetaKey>("visao-geral")`; query string opcional `?meta=cmv-salmao` para deep-link.

### 2. `src/components/dashboard/painel-metas/` — extrair subviews (novo diretório)
Quebrar o arquivo de 2047 linhas em módulos enxutos:
- `PainelSidebar.tsx` — navegação interna
- `MetaPageHeader.tsx` — título + seletor de mês + botão IA
- `views/VisaoGeralView.tsx` (atual, refinada com gráficos)
- `views/NpsView.tsx` (atual, refinada)
- `views/CmvSalmaoView.tsx` **NOVO**
- `views/CmvCarnesView.tsx` **NOVO**
- `views/KdsView.tsx` **NOVO** (extrai bloco KDS de Conformidade hoje)
- `views/ConformidadeView.tsx` (existe, refinada)
- `views/RedFlagView.tsx` **NOVO**
- `views/PlanosView.tsx` (existe, mantida)
- `shared/Sixmonths.tsx` **NOVO** — componente reutilizável "Sua Loja · 6 meses"
- `shared/RankingCard.tsx` **NOVO** — ranking comparativo entre lojas com medalhas 1/2/3
- `shared/KpiByStoreGrid.tsx` **NOVO** — grid de 4 KPIs por unidade (estilo do mockup)
- `shared/MetaInteractiveChart.tsx` **NOVO** — wrapper recharts com tooltip touch-friendly + responsive

### 3. Componente `Sixmonths` — comparativo da loja do usuário
Props: `metaCode`, `unidadeId` (vem de `useUnidade().effectiveUnidadeId`), `mes` (atual).

Faz uma única query agregando os 6 meses retroativos para a unidade. Calcula:
- Valor do mês atual
- Melhor mês (maior/menor conforme polaridade da meta)
- Pior mês (oposto)
- Variação % atual vs. melhor / vs. pior

Renderiza:
```
┌──────────────────────────────────────────────────┐
│ Sua loja · Últimos 6 meses · CMV Salmão          │
├──────────────┬───────────────┬───────────────────┤
│ ATUAL Abr/26 │ MELHOR Fev/26 │ PIOR Dez/25       │
│  1.71kg      │  1.52kg ✓     │  1.94kg ✗         │
│              │  -11% vs atual│  +13% vs atual    │
├──────────────┴───────────────┴───────────────────┤
│ [sparkline interativo 6 meses com pontos clicáveis] │
└──────────────────────────────────────────────────┘
```
Usa `recharts.AreaChart` com gradiente coral, dot ativo destacando mês atual, tooltip touch-friendly.

### 4. Fonte de dados por meta
Cada `view` usa as tabelas já existentes — nada novo no banco:

| Meta | Tabela principal | Polaridade |
|---|---|---|
| NPS Salão / Delivery | `reclamacoes` + `store_performance_entries` | maior R$/reclam = melhor |
| CMV Salmão | `cmv_contagens` + `store_performance_entries` (kg/R$1k) | menor = melhor |
| CMV Carnes | `cmv_camara` / `cmv_movements` (% desvio) | menor = melhor |
| KDS · Tempo Prato | `avaliacoes` (codigo_meta=`tempo_prato`) | maior % OK = melhor |
| Conformidade | `leadership_store_scores` + `audit_sector_scores` | maior = melhor |
| Red Flag | `leadership_calculation_log` + `leadership_performance_scores` | menos = melhor |

Helper `metaPolarity[code]: 'higher' | 'lower'` decide qual extremo é "melhor" no ranking e no comparativo 6M.

### 5. Visual interativo & responsivo (touch)
- **Recharts** já está no projeto — adicionar `BarChart`, `AreaChart`, `RadialBarChart` onde fizer sentido.
- Tooltips: `<Tooltip wrapperStyle={{ touchAction: 'none' }} />` + `cursor={{ stroke }}` para dedo grosso.
- Cards com `hover-lift` + `glass-card` (já existem). Ranking rows com medalhas (ouro/prata/bronze) reaproveitando classes do mockup mas em tokens semânticos.
- Mobile-first: sidebar interna vira drawer, KPIs em 2 colunas, gráficos em 1 coluna full-width, swipe horizontal para tabela de heatmap.
- Banner "Red Flag ativa" no topo do Visão Geral, igual ao mockup, lendo `leadership_calculation_log` do mês.

### 6. Motores de importação — preservados
Nada se mexe em:
- `AiImportSection`, `MultiLinkSheetsSync`, `LegacySyncPanel`
- Edge functions `cron-import-sheets`, `sync-google-sheets`, `extract-*`
- `HoldingCentralTab`, `DiarioView` continuam acessíveis (sidebar group "Admin" só visível para admin/operator).

## Detalhes técnicos

- Sem mudanças de schema. Tudo já existe em `leadership_store_scores`, `reclamacoes`, `cmv_*`, `avaliacoes`, `supervision_audits`.
- `useUnidade()` continua sendo SSOT da loja do usuário; admin sem unidade vê o bloco "Sua Loja · 6 meses" com seletor local de loja.
- Query keys versionadas: `["painel", metaCode, mes, unidadeId]` para evitar cache cross-meta.
- `Date handling`: continuar `YYYY-MM` puro (memoria já registrada).
- Acessibilidade: `aria-current="page"` na meta ativa, `aria-label` em ranking medalhas, foco visível em cards interativos.
- Performance: cada view é code-split via `React.lazy` para o root carregar leve.

## Resultado esperado

Ao abrir o Painel de Metas:
1. Sidebar interna lista cada indicador como "página" individual (estilo mockup HTML).
2. Cada meta tem KPIs por loja, ranking comparativo entre lojas e gráficos interativos do mês selecionado.
3. Quando o usuário (não-admin) entra numa meta, vê **abaixo do conteúdo de rede** um bloco "Sua Loja · Últimos 6 meses" comparando seu mês atual com o melhor e o pior dos últimos 6 meses **da própria loja**.
4. Visual coerente com o restante do portal (Liquid Glass, coral, sem emojis), gráficos responsivos a toque e sem perder nenhum recurso atual de importação.
