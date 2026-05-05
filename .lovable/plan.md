## Objetivo

Substituir a fonte de dados do Painel de Indicadores (hoje `useSheetBlocks` lendo `sheets_blocks_snapshot` populado pela edge function `sync-sheets-staging`) por um fluxo de **upload manual de planilha Excel por mês**. Cada upload gera um snapshot versionado em `indicadores_snapshots`, permitindo navegar pelo histórico mês a mês.

O motor de sync (Sheets → staging) **permanece intacto**. Apenas o painel passa a consumir a nova tabela de snapshots.

## Escopo (5 indicadores)

| meta_key | Label |
|---|---|
| `ranking-supervisores` | Ranking Supervisores (Checklist) |
| `nps` | NPS — Notas de Atendimento |
| `atendimento-medias` | Avaliações 1-3 / Faturamento |
| `kds-target-preto` | KDS — Target Preto |
| `reclamacoes` | Base de Avaliações / Comentários |

## Etapa 1 — Migration

Criar tabela `public.indicadores_snapshots`:

- `id uuid PK`, `meta_key text`, `referencia_mes text` (`YYYY-MM`), `referencia_label text`, `dados jsonb`, `arquivo_nome text`, `linhas_importadas int`, `uploaded_by uuid → auth.users`, `created_at timestamptz`
- `UNIQUE(meta_key, referencia_mes)` — permite upsert por mês
- RLS habilitado: SELECT/INSERT/UPDATE para `authenticated` (mesmo padrão dos outros snapshots do painel)

## Etapa 2 — Hooks

`src/hooks/useIndicadoresSnapshot.ts`:

- `useIndicadoresSnapshot(metaKey, referenciaMes?)` — retorna `{ dados, meta, loading, error }`. Sem `referenciaMes` → busca o mais recente (`order referencia_mes desc limit 1`).
- `useIndicadoresHistorico(metaKey)` — lista de `SnapshotMeta[]` (sem `dados`) ordenada DESC, para popular o seletor.

## Etapa 3 — Parsers client-side (SheetJS)

`xlsx` já está disponível no projeto. Criar `src/lib/indicadores-parsers.ts` com helpers `sheetToGrid`, `toNum`, `toStr` e 5 funções `parse*(wb)` → `{ dados, linhas }`:

1. **parseSupervisoresRanking** — aba `GERAL E GERENTES`; detecta seções `geral` / `gerenteBack` / `gerenteFront`; lê `posicao` (col C), `unidade` (D), `media` (E); captura `Período:`.
2. **parseNpsAtendimento** — aba `BASE dados`; grupos de 4 colunas (offsets 0,4,8,12); agrega por restaurante separando Atendimento (Google + TripAdvisor) vs Delivery (iFood + iFood Dark) com média ponderada.
3. **parseAvaliacoesFaturamento** — primeira aba; detecta dinamicamente colunas "Loja" do bloco Salão e Delivery; lê 6 colunas por bloco.
4. **parseKdsTargetPreto** — aba `Salão` (fallback primeira); extrai data de atualização da linha 0; agrupa por loja com categorias e total geral.
5. **parseBaseAvaliacoes** — abas `Consolidado` → `Google` → primeira; retorna **todas** as avaliações (filtro fica no componente).

Mapa `PARSERS` indexado por `meta_key`. A lógica espelha os parsers da edge function, adaptada para `XLSX.WorkBook` (células podem ser numéricas nativas).

## Etapa 4 — UploadIndicadorModal

`src/components/indicadores/UploadIndicadorModal.tsx` — Dialog estilo glass + accent amber:

1. Select de indicador (5 opções com labels amigáveis).
2. `input type="month"` para mês de referência; gera label `"Abril 2026"` em pt-BR.
3. Drag-and-drop `.xlsx/.xls`; ao soltar, roda o parser correspondente e mostra preview ("✓ X registros" ou "✗ formato não reconhecido").
4. Botão **Confirmar**: `upsert` em `indicadores_snapshots` por `(meta_key, referencia_mes)`, toast de sucesso, fecha modal e invalida queries (`['indicadores_snapshot', metaKey]` e `['indicadores_historico', metaKey]`).

## Etapa 5 — HistoricoUploads

`src/components/indicadores/HistoricoUploads.tsx`:

- Recebe `metaKey`, `referenciaMes`, `onChange`.
- Lista chips horizontais com os meses disponíveis (label "Abr 2026"); ativo = filled amber, demais outline amber, hover destaca.
- Vazio → mensagem "Nenhum upload ainda".

## Etapa 6 — Integração nos dashboards

Os "dashboards" hoje são **views + blocks** sob `src/components/dashboard/painel-metas/`. Plano de integração mínima sem reescrever views:

- Criar wrappers em `src/components/indicadores/dashboards/`:
  - `SupervisoresRankingDashboard`, `NpsAtendimentoDashboard`, `AvaliacoesFaturamentoDashboard`, `KdsTargetPretoDashboard`, `ReclamacoesCommentsDashboard`.
- Cada wrapper:
  - Estado local `referenciaMes` (default = mais recente do histórico).
  - Header: chip do período ativo + `<HistoricoUploads>` + botão **＋ Upload** que abre `<UploadIndicadorModal metaKey={...} />`.
  - Consome `useIndicadoresSnapshot(metaKey, referenciaMes)` e renderiza a visualização da Etapa 7.
- Substituir os pontos atuais que renderizam dados desses 5 `meta_key`s:
  - `NpsReclamacoesView.tsx`: trocar `<SheetBlocksSection metaKey="reclamacoes" />` e `metaKey="nps"` pelos novos dashboards.
  - `KdsConformidadeView.tsx` (`metaKey="target-preto"`) → `<KdsTargetPretoDashboard />` (mapear chave para `kds-target-preto`).
  - `RankingView.tsx` → embutir `<SupervisoresRankingDashboard />`.
  - `AvaliacoesFaturamentoDashboard` adicionado onde hoje há ranking de atendimento (dentro de `NpsReclamacoesView` ou nova seção).
- Demais usos de `useSheetBlocks` (conformidade, visao-geral, etc.) **não são alterados** — sync atual segue ativo para eles.

## Etapa 7 — Visualizações (glass + amber)

Cada wrapper renderiza a visão correspondente, mantendo o design system Liquid Glass + accent amber/coral:

- **Supervisores**: 3 cards (Geral / Back / Front), tabela ranking com pódio destacado.
- **NPS**: dois rankings lado a lado (Atendimento / Delivery), barras proporcionais à média, badge com nº de avaliações.
- **Avaliações × Faturamento**: tabelas Salão e Delivery com colunas de % e R$/avaliação; heat color por % de notas baixas.
- **KDS Target Preto**: accordion por loja; total geral em destaque + categorias com barra de % preto (verde < meta, amber, vermelho).
- **Reclamações**: mural com filtros (loja, nota ≤3, busca textual); cards com nota, autor, comentário, data.

Conteúdo detalhado de UI segue o "Prompt 2 anterior" referenciado pelo usuário (mesmas regras de cor, pódio, barras, accordion, filtros).

## Restrições respeitadas

- Não tocar em `/auth`, `/agenda`, `/contagem-utensilios`, `/confirm-shift/:id`, `/checklist/:token`, `/checkin`.
- Edge function `sync-sheets-staging` e tabela `sheets_blocks_snapshot` permanecem; outras views que as consomem seguem funcionando.
- Rotas atuais (`/painel/metas`) preservadas — apenas o conteúdo dos 5 indicadores muda de fonte.

## Ordem de execução

1. Migration SQL.
2. `useIndicadoresSnapshot` + `useIndicadoresHistorico`.
3. `indicadores-parsers.ts` + `PARSERS` map.
4. `UploadIndicadorModal`.
5. `HistoricoUploads`.
6. 5 dashboards wrappers + integração nas views existentes.
7. Visualizações finais com design glass+amber.
