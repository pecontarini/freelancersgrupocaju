## Objetivo

Reescrever 5 parsers da edge function `sync-sheets-staging` para ler corretamente as abas/colunas reais das planilhas, ajustar a URL da fonte NPS para a aba "BASE dados", e atualizar o `dispatchParser` para mapear as novas chaves.

Sem alterar UI, hooks ou outros parsers (`parseConformidade`, `parseCmvSalmaoSeries`, `parseCmvCarnesItens`, `parseGenericMeta` ficam intactos).

---

## Etapa 1 — UPDATE da URL da fonte NPS (data operation)

Via tool `supabase--read_query` + insert/update tool (data, não migration):

```sql
UPDATE sheets_sources
SET url = 'https://docs.google.com/spreadsheets/d/138MkoGLwTM10q8I_9hQCyOpeVQy2UhcB/gviz/tq?tqx=out:json&sheet=BASE%20dados'
WHERE meta_key = 'nps';
```

A função `extractSheetParams` extrai `sheetId` corretamente; quando `gid` é null e a URL contém `&sheet=...`, o `buildGvizUrl` precisa preservar isso. Verificar — caso contrário, ajustar `extractSheetParams` para também capturar o parâmetro `sheet=` e usá-lo como nome de aba em `buildGvizUrl`.

---

## Etapa 2 — Reescrever parsers em `supabase/functions/sync-sheets-staging/index.ts`

Substituir as 5 funções abaixo (mantendo assinatura `(grid: string[][]) => ParseResult`):

### 2.1 `parseSupervisoresRanking` (NOVA — substitui o uso de `parseGenericMeta` para `ranking-supervisores`)

- Detecta seções por header contendo `GERAL`, `GERENTE BACK`, `GERENTE FRONT`.
- Captura período da linha de seção (regex `/Período[:\s]+(.+)/i`) ou linha seguinte.
- Para cada linha após header: busca padrão `[posição com "º", unidade, valor com "%"]`.
- Ignora "Total Geral", "Período:", cabeçalhos.
- Emite 3 blocks `ranking` (`ranking_geral`, `ranking_back`, `ranking_front`), cada um com `payload: { label, periodo, suffix: '%', polarity: 'higher', items: [{posicao, loja_codigo, valor}] }`.
- `rows` (KPI agregado): valores da seção GERAL.

### 2.2 `parseNpsAtendimento` (substitui `parseAtendimentoMedias` para `nps`)

- Skip linha 0 (header).
- Para cada linha, lê 4 grupos de 4 colunas em offsets 0, 4, 8, 12: `{plataforma, restaurante, nota:int, qtd:int}`.
- Ignora itens com `qtd === 0` ou restaurante vazio.
- Mapeia `restaurante` via `matchLojaCodigo`.
- Agrupa por loja:
  - **Atendimento** = Google + TripAdvisor (grupos 0, 1) — média ponderada `Σ(nota·qtd)/Σ(qtd)`.
  - **Delivery** = iFood + iFood Dark (grupos 2, 3) — mesma fórmula.
- Emite 2 blocks `ranking`:
  - `ranking_atendimento` (polarity higher, decimals 2, suffix '★'), itens ordenados desc.
  - `ranking_delivery` (idem).
- `rows`: para cada loja, valor = média de atendimento (ou geral se atendimento ausente).

### 2.3 `parseAvaliacoesFaturamento` (NOVA — usada por `atendimento-medias`)

- Linha 0 vazia, linha 1 contém títulos "Salão" / "Delivery" (extrair período se presente em linha 0 ou junto).
- Bloco Salão: cols B–G (índices 1–6): `[loja(1), aval13(2), totalAval(3), pct(4), fatTotal(5), rsPorAval(6)]`.
- Bloco Delivery: cols H–M (índices 7–12): mesma ordem em `[7..12]`.
- Dados a partir da linha 2; parar quando `loja` (col 1 ou 7) vazia.
- Helpers locais: `parseBRL`, `parsePct`.
- Emite block único `item_table` `tabela_aval_fat` com `payload: { label, periodo, salao: [...], delivery: [...] }`.
- `rows`: opcional — média de `pct` (Salão) por loja para KPI agregado.

### 2.4 `parseKdsTargetPreto` (substitui o atual `parseTargetPretoKds`)

- Linha 0: extrair "Data de Atualização DD/MM/YYYY" via regex.
- Linha 1 vazia, linha 2 cabeçalho (skip).
- Cols: `[Loja(0), Categoria(1), TotalPratos(2), QtnTargetPreto(3), PctTargetPreto(4)]`.
- Itera linhas a partir de 3, mantendo `currentLoja`. Se `loja` preenchida → atualiza atual; se `loja` vazia + `categoria` contém "Total Geral" → linha de total da loja atual.
- Agrupa por loja: `{loja, categorias: [...], totalGeral: {...}}`.
- Emite blocks: `ranking_target_preto` (por totalGeral.pct, polarity lower) e `matrix_categoria_loja`. `kpi_strip` opcional com `dataAtualizacao`.
- `rows`: `valor = totalGeral.pct` por loja.

### 2.5 `parseBaseAvaliacoes` (substitui `parseReclamacoesDist` para `reclamacoes`)

- Header linha 0: `[Loja(0), Data(1), DiaSemana(2), Nota(3), Autor(4), Comentario(5)]`.
- Dados linha 1+. Converte `Nota → int`, `Data DD/MM/YYYY → ISO`.
- Ignora linhas sem comentário (col 5 vazia).
- Filtra `nota <= 3`.
- Emite block único `item_table` `mural_reclamacoes` com `payload: { totalLinhas, items: [{loja_codigo, data_iso, dia_semana, nota, autor, comentario}] }`.
- `rows`: contagem de reclamações por loja como `valor` (KPI).

---

## Etapa 3 — Atualizar `dispatchParser`

Substituir o switch para:

```ts
case 'conformidade': return parseConformidade(grid);
case 'kds':
case 'kds-target-preto':
case 'target-preto':         return parseKdsTargetPreto(grid);
case 'nps':                  return parseNpsAtendimento(grid);
case 'atendimento-medias':   return parseAvaliacoesFaturamento(grid);
case 'reclamacoes':          return parseBaseAvaliacoes(grid);
case 'cmv-salmao':           return parseCmvSalmaoSeries(grid);
case 'cmv-carnes':           return parseCmvCarnesItens(grid);
case 'ranking-supervisores': return parseSupervisoresRanking(grid);
default:                     return parseGenericMeta(grid);
```

---

## Etapa 4 — Pequeno ajuste em `extractSheetParams` / `buildGvizUrl`

Para suportar URL com `&sheet=BASE%20dados` (sem gid numérico), capturar também o parâmetro `sheet` da URL original e, se presente, passá-lo em `buildGvizUrl` como nome de aba quando `gid` for null.

```ts
function extractSheetParams(url: string) {
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const sheetMatch = url.match(/[#&?]sheet=([^&]+)/);
  return {
    sheetId: idMatch?.[1] ?? '',
    gid: gidMatch?.[1] ?? null,
    sheetName: sheetMatch ? decodeURIComponent(sheetMatch[1]) : null,
  };
}
```

E no handler principal: `gid ?? sheetName` na chamada de `buildGvizUrl`.

---

## Etapa 5 — Deploy + teste

- Deploy de `sync-sheets-staging`.
- Disparar sync manual nas 5 fontes e verificar logs (`rowsImported`, `blocksImported`).

---

## Restrições

- Não tocar em `parseConformidade`, `parseCmvSalmaoSeries`, `parseCmvCarnesItens`, `parseGenericMeta`.
- Não alterar hooks (`useSheetsSources`, `useSheetBlocks`, `useSheetData`) nem componentes UI.
- Não alterar rotas: `/auth`, `/agenda`, `/contagem-utensilios`, `/confirm-shift/:id`, `/checklist/:token`, `/checkin`.
