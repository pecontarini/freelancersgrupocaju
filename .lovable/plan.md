
## Diagnóstico

**O que existe hoje (Configurações):**
- `MetaSheetsLinker` salva o link em `sheets_sources(meta_key, url, ativo)`.
- Botão "Sincronizar" chama `sync-sheets-staging`, que assume layout fixo `unidade,data_referencia,faturamento,nps,nota_reclamacao` e grava em `sheets_staging`.

**O que existe hoje (Painel `/painel/metas`):**
- Conformidade (`ConformidadeDetailView`) lê de `audit_sector_scores` via `useConformidadeData` — auditorias internas. **Não lê nada de `sheets_sources`.**
- Visão Geral, NPS, KDS e CMV leem de `metas_snapshot` via `useMetasSnapshot`.
- `sheets_staging` é gravado, mas **nunca é promovido para `metas_snapshot`** (não há job que copie staging → snapshot).

**Conclusão da causa raiz:**
1. A planilha de Conformidade que você vinculou tem layout próprio (3 blocos de ranking: GERAL / BACK / FRONT, com colunas `Unidade` + `Média %`), totalmente diferente do que `sync-sheets-staging` espera — então o sync falha silenciosamente ou ignora as linhas.
2. Mesmo se gravasse no staging, **nada promove** os dados para `metas_snapshot.conformidade`, que é o que alimenta os cards do painel.
3. A view de Conformidade está hard-coded para `audit_sector_scores` e ignora qualquer fonte vinculada.

## Plano

### 1. Edge Function `sync-sheets-staging` — virar dispatcher por meta
Reescrever para ler `meta_key` da `sheets_sources`, baixar CSV, e despachar para um parser específico:
- `parseConformidade(csv)` → extrai linhas dos 3 blocos (GERAL, GERENTE BACK, GERENTE FRONT), normaliza unidade (`CP AN`, `NZ GO`, etc → `loja_codigo`), converte `"88,98%"` → 88.98.
- `parseNps(csv)` → mantém heurística atual (faturamento + reclamações → NPS).
- `parseCmvSalmao`, `parseCmvCarnes`, `parseKds` → placeholders que aceitam layout `Unidade,Mes,Valor`. Quando você me mandar exemplos das outras 4 planilhas, ajusto cada parser.

Cada parser retorna `{ loja_codigo, mes_ref, valor }[]` e a função faz `upsert` direto em **`metas_snapshot`** na coluna correspondente (`conformidade`, `nps`, `cmv_salmao`, etc.) + preenche `*_anterior` com o valor do mês passado existente.

### 2. Promoção automática (sem botão extra)
- Mantém o botão "Sincronizar" do card por meta (já existe).
- Adiciona job no `cron-import-sheets` que roda a cada hora para fontes ativas.
- Cada sync grava `ultima_sincronizacao` e exibe contagem de linhas atualizadas no toast.

### 3. View de Conformidade (`ConformidadeDetailView`) — passar a respeitar a fonte
Quando existe `sheets_sources` ativa para `meta_key='conformidade'`, prioriza:
- Cards "Back / Front / Total por loja" → lê `metas_snapshot.conformidade` (já preenchido pelo sync).
- Mantém `audit_sector_scores` como **fallback** quando não há fonte vinculada.
- Adiciona badge "Fonte: planilha vinculada — sincronizada há Xmin" no header da view.

### 4. UI Configurações — feedback de sincronização
- Após clicar "Sincronizar", mostra resumo: `X lojas atualizadas em metas_snapshot · mês YYYY-MM`.
- Se parser não reconhece o layout, mensagem clara: "Layout não reconhecido para a meta 'Conformidade'. Esperado: bloco com colunas Unidade + Média."

### 5. Restrições
- Não toco em `audit_sector_scores`, `useConformidadeData` (mantenho como fallback), nem nas rotas restritas.
- Não altero o schema de `metas_snapshot` (colunas já existem).
- Mantenho `sheets_staging` como log de auditoria (gravo lá em paralelo).

## Detalhes técnicos

```text
Configurações (MetaSheetsLinker)
   └─ INSERT sheets_sources(meta_key, url, ativo)
                │
                ▼
sync-sheets-staging (dispatcher por meta_key)
   ├─ fetch CSV
   ├─ parser específico → rows {loja_codigo, mes_ref, valor}
   ├─ INSERT sheets_staging (auditoria)
   └─ UPSERT metas_snapshot.<coluna_da_meta>
                │
                ▼
Painel /painel/metas
   ├─ useMetasSnapshot → cards/series (já funciona)
   └─ ConformidadeDetailView → lê snapshot quando há fonte vinculada
```

**Próximo passo após aprovação:** implemento o parser de Conformidade (única planilha que tenho acesso hoje) + dispatcher + leitura na view. Para NPS/KDS/CMV, peço que você compartilhe os links — adapto cada parser em incremento curto.
