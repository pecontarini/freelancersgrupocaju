## Diagnóstico

Os parsers atuais foram desenhados pra um layout "Unidade | Valor" simples, mas nenhuma das 7 planilhas vinculadas tem esse formato. Por isso `sheets_blocks_snapshot` está vazia (confirmado via SQL) e os blocks no painel mostram "Vincule uma planilha…".

Formato real de cada planilha (amostra lida via CSV export):

| meta_key | Layout real | Layout que o parser atual espera |
|---|---|---|
| `conformidade` | 3 rankings empilhados (Geral / Back / Front) com `Pos | Unidade | %` | ✅ próximo do correto, só precisa ajuste de detecção |
| `kds` (Target Preto) | 3 blocos **lado a lado** (Caminito / Nazo / Caju) — cada bloco é `Loja | Categoria | Total | Qtn | %` | ❌ espera matriz Categoria × Loja |
| `nps` (Médias Atendimento) | 2 grandes blocos: "Google+TripAdvisor" e "iFood/Delivery", cada um com sub-blocos por loja | ❌ espera header "Loja | Google | iFood…" |
| `reclamacoes` (Distribuição) | Bloco "Geral Grupo" + N blocos por loja, todos com colunas `iFood | Google | TripAdvisor | Get In | Instagram | Whatsapp | Total | %` e linhas 1‒5 | ❌ espera lojas em linhas |
| `cmv-salmao` | **Lojas como colunas** (Águas Claras, SIG, Asa Sul, Goiânia), datas em linhas, com faixas verde/amarelo/vermelho | ❌ espera lojas em linhas, datas em colunas |
| `cmv-carnes` | 2 blocos lado a lado (Caminito Águas Claras / Caminito Norte), cada um com `Custo | Item | 01/04 | Envios | Envios R$ | Devolução | Vendas | Era pra Ter | 01/05 | Diferença | Vlr Total | Diff %` | ❌ delega pra parseTargetPreto |
| `target-preto` | mesma planilha do KDS (gid 0) | ❌ idem KDS |

## Plano

### 1. Reescrever parsers em `supabase/functions/sync-sheets-staging/index.ts`

Adicionar utilitários:
- `findAllUnitHeaders(grid)` — varre o grid inteiro procurando células que são código de loja (via `matchLojaCodigo`), retorna posições para detectar blocos lado-a-lado e blocos empilhados.
- `parseDateBR(s)` — `dd/mm/aaaa` → `YYYY-MM-DD`.
- `splitGridIntoHorizontalBlocks(grid)` — detecta colunas vazias persistentes pra separar blocos horizontais.

Reescrever os 6 parsers:

**`parseConformidade`** (mantém base, ajusta detecção):
- Scaneia por células com posição `1°…10°` na coluna seguinte do bloco.
- Mantém 3 sections (geral/back/front) → 3 blocks `ranking`.

**`parseTargetPretoKds`** (novo, substitui `parseTargetPreto` atual):
- Detecta header repetido `Loja | Categoria | Total de Pratos | Qtn. Target Preto | % Target Preto`.
- Para cada bloco horizontal, lê linhas até "Total Geral".
- Saída:
  - `block_type='matrix'` com `categorias` × `lojas` (% Target Preto).
  - `block_type='ranking'` "Total Geral por loja" (% agregado).
  - `block_type='item_table'` "Pratos com mais Target Preto" (top 10 por Qtn).
- Agrega `metas_snapshot.kds` = % Total Geral.

**`parseAtendimentoMedias`** (novo, planilha NPS médias):
- Detecta blocos de loja (cabeçalho com nome da loja + canais).
- Para cada bloco, extrai média Google + TripAdvisor e iFood separadamente.
- Saída:
  - `item_table` "Médias por canal" (loja × canal × nota).
  - `ranking` "Atendimento (Google+Trip)" e `ranking` "Delivery (iFood)".
  - `kpi_strip` com média geral do grupo.

**`parseReclamacoesDistribuicao`** (reescreve):
- Detecta os blocos "Geral Grupo" + por loja.
- Para cada bloco extrai distribuição 1‒5 por canal e calcula:
  - Média ponderada da loja.
  - % de notas 1‒2 (insatisfação).
- Saída:
  - `distribution` (notas 1‒5 stacked) por loja.
  - `matrix` canal × nota agregada (Geral Grupo).
  - `ranking` "% Insatisfação" (lower=worse).
  - `kpi_strip` "Notas 5 / Total" e "Insatisfação % grupo".
- Agrega `metas_snapshot.nps` = média ponderada.

**`parseCmvSalmaoSeries`** (reescreve):
- Detecta header com lista de lojas em colunas (Águas Claras, SIG, Asa Sul, Goiânia).
- Linhas: `Data | Dia da Semana | <valor por loja>`.
- Lê faixas (Verde ≤1,55 / Amarelo 1,56‒1,65 / Vermelho > 1,65) da própria planilha, salva como `thresholds` no payload.
- Saída:
  - `series` (eixo X = data, uma série por loja, com bandas de faixa).
  - `ranking` "Média do mês por loja".
  - `matrix` "Dias acima do limite por loja".
- Agrega `metas_snapshot.cmv_salmao` = média da loja no mês.

**`parseCmvCarnesItens`** (novo):
- Para cada bloco de loja, lê itens (PO ANCHO 250G…) com colunas Envios / Vendas / Era pra Ter / 01/05 (estoque) / Diferença / Vlr Total / Diff %.
- Saída:
  - `item_table` "Desvios de carnes por loja" (com filtro/sort por |Diff %|).
  - `ranking` "Perda total R$ por loja" (soma Vlr Total negativo).
  - `matrix` "Diferença % item × loja" (heatmap).
- Agrega `metas_snapshot.cmv_carnes` = média ponderada |Diff %|.

### 2. Componentes de visualização novos / atualizados em `src/components/dashboard/painel-metas/blocks/`

Atualizar:
- `RankingBlock.tsx` — aceitar `polarity` (lower/higher) pra colorir e badge "↓ menor é melhor".
- `MatrixBlock.tsx` — modo heatmap (cor por valor com escala min/max do payload).
- `SeriesBlock.tsx` — usar Recharts `LineChart` multi-série + `ReferenceArea` pras faixas verde/amarelo/vermelho do payload `thresholds`.
- `DistributionBlock.tsx` — barra empilhada (1=vermelho, 5=verde) + chip "% insatisfação".
- `ItemTableBlock.tsx` — search + sort + paginação client-side, suporte a colunas tipadas (R$, %, número).

Adicionar:
- `KpiStripBlock.tsx` — faixa horizontal de KPIs (média grupo, total avaliações, etc), responsivo.

### 3. Cabeçalho de cada view

Em `ConformidadeDetailView`, `KdsConformidadeView`, `NpsReclamacoesView`, `CmvDetailView` adicionar:
- Botão "Sincronizar planilha" (chama `sync-sheets-staging` com o `sourceId` da meta).
- Selo "Última atualização: 05/05 14:32".
- `<SheetBlocksSection metaKey={…} mesRef={…} />` já existe — só passar `polarity`/`emptyMessage` mais útil.

### 4. Migração mínima

Nenhuma mudança de schema — `sheets_blocks_snapshot.payload` é JSONB, suporta os novos formatos. Só `INSERT/UPDATE` via edge function.

### 5. Validação

Após deploy do edge function:
1. Disparar "Sincronizar agora" pra cada uma das 7 fontes.
2. Conferir via SQL `SELECT meta_key, block_type, count(*) FROM sheets_blocks_snapshot GROUP BY 1,2;` que cada meta tem ≥1 block.
3. Abrir `/painel/metas` em cada aba e validar visualmente.

### Detalhes técnicos
- O detector horizontal-block usa heurística: encontra coluna `j` cuja média de células vazias entre linhas N e N+30 é >70% → marca como separador.
- Datas em PT-BR são parseadas com regex `^(\d{2})\/(\d{2})\/(\d{4})$`.
- Valores monetários `R$ 28,19` e `-R$ 591,99` tratados em `parseBRL` (separado de `parsePercentOrNumber` pra não confundir milhar `.` com decimal `,`).
- Códigos de loja "Caminito Norte" precisam ser adicionados ao `UNIT_ALIAS` (não existe ainda — provavelmente é CP_AN).
- Idempotência: cada parser usa `block_key` estável; upsert por `(meta_key, mes_ref, loja_codigo, block_key)`.

Tempo estimado: ~1 ciclo grande de implementação (parsers + 1 componente novo + ajustes nos 4 views).
