
## Escopo aprovado

Seguir com o pipeline das 7 planilhas + planilha #3 com placeholder. Comentários de reclamações (Parte B) entram **agora como infraestrutura pronta**, mas ficam **desligados/ocultos por padrão** — você liga via toggle em Configurações quando quiser começar a popular.

---

## Parte A — Pipeline base (7 planilhas)

### A1. Banco
Migration:
- `sheets_blocks_snapshot(id, source_id, meta_key, block_key, block_type, mes_ref, loja_codigo nullable, payload jsonb, ordem int, updated_at)` + RLS leitura autenticada, escrita service_role.
- Índice `(meta_key, mes_ref)` e `(source_id)`.

### A2. Edge function `sync-sheets-staging`
Refator para dispatcher por `meta_key` com 7 parsers:
- `parseConformidade` (já existe — mantém)
- `parseTargetPreto` — matriz Categoria × Loja
- `parseAtendimentoMedias` (#3) — tolera vazio, gera bloco `{rows: []}`
- `parseAvaliacoes13` — faturamento × avaliações 1-3
- `parseReclamacoesDistribuicao` — distribuição 1-5 estrelas
- `parseCmvSalmao` — série diária
- `parseCmvCarnes` — tabela itemizada

Cada parser grava:
1. KPI agregado em `metas_snapshot` (quando aplicável).
2. Blocos estruturados em `sheets_blocks_snapshot`.

### A3. UI Configurações
`MetaSheetsLinker`: 6 entradas novas (já tem Conformidade). Cada uma com link, sync manual e badge de última sincronização.

### A4. Componentes de bloco
Em `src/components/dashboard/painel-metas/blocks/`:
- `RankingBlock`, `MatrixBlock`, `SeriesBlock`, `DistributionBlock`, `ItemTableBlock`, `KpiStripBlock`, `SheetSourceBadge`, `EmptyBlockState`.

### A5. Hook + integração
- `useSheetBlocks(metaKey, mesRef)` — busca blocos por meta.
- Atualizar 4 views: Conformidade, NPS/Reclamações, KDS/Atendimento, CMV.

### Tratamento da #3 (placeholder)
- Vincula link agora.
- Parser tolera headers sem dados → bloco vazio.
- UI mostra `EmptyBlockState`: "Aguardando primeiros dados — fonte vinculada em DD/MM. Próximo sync automático às 6h."
- Quando você popular, aparece sozinho no próximo sync.

---

## Parte B — Comentários de reclamações (infra pronta, desligado por padrão)

### B1. Banco
Migration:
- `reclamacoes_comentarios(id, loja_codigo, canal, nota, data_comentario, autor, comentario, tags text[], status, action_plan_id, source_hash unique, source_id, created_at, updated_at)` + RLS (leitura por loja do usuário, escrita admin/operador + service_role).
- `reclamacoes_config(enabled boolean default false, source_id uuid, classificador_ai boolean default false, updated_at)` — singleton por org.

### B2. Edge function
- Novo parser `parseReclamacoesComentarios` no dispatcher, ativado **somente se `reclamacoes_config.enabled = true`**.
- Upsert idempotente por `source_hash = sha256(data|loja|canal|autor|comentario)`.
- Cron diário já existente cobre automaticamente.

### B3. UI Configurações — toggle
Card novo "Comentários de reclamações" em Configurações:
- Switch **Ativar coleta de comentários** (default OFF).
- Quando ligado: campo de link da aba + botão Sincronizar + opção "Classificar tags com IA".
- Esquema esperado documentado inline: `data | loja | canal | nota | autor | comentario`.

### B4. UI Painel — Mural (oculto enquanto desligado)
Aba "Mural de Comentários" dentro de Reclamações aparece **só se `enabled = true`**:
- Filtros: loja, canal, nota (default 1-3), período, status, busca.
- Cards por comentário com nota colorida, canal, data, autor, texto, tags, status.
- Ações: marcar em análise / descartar / **gerar plano de ação** (cria `action_plan` pré-preenchido linkado via `action_plan_id`) / copiar para WhatsApp.
- Resumo topo: contagem por status, distribuição por canal, top 3 lojas.

### B5. Classificador opcional (Lovable AI)
- Edge chama `gemini-2.5-flash` por lote para gerar `tags`.
- Liga/desliga por toggle. Sem custo extra para você.

### Como você "liga" no futuro
1. Cria aba `Comentários` na planilha #5 com as 6 colunas.
2. Configurações → Comentários de reclamações → ativa o switch + cola o link CSV.
3. Sync roda. Mural aparece no painel.

---

## Ordem de implementação

1. Migration (`sheets_blocks_snapshot` + `reclamacoes_comentarios` + `reclamacoes_config`).
2. Refator `sync-sheets-staging` com 7 parsers + parser de comentários gated por flag.
3. `MetaSheetsLinker` com 6 novas metas + card de Comentários (toggle).
4. Biblioteca de blocos + hook `useSheetBlocks`.
5. Integração nas 4 views do painel.
6. Mural de Comentários (renderizado condicionalmente).
7. Classificador AI (toggle).

Cada passo é entregável e validável independentemente.

## Premissas que vou adotar (ajusto depois se precisar)

- Planilha #3: layout `Loja | Google | TripAdvisor | iFood`.
- Comentários: esquema padrão `data | loja | canal | nota | autor | comentario` (extras ignorados).
- Classificador AI inicia **desligado**; você liga quando quiser testar.
