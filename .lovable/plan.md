## Objetivo

Criar, na aba **Configurações**, uma seção dedicada onde o admin associa **uma planilha Google Sheets a cada meta** do Painel de Indicadores (NPS, CMV Salmão, CMV Carnes, KDS, Conformidade, Reclamações etc.). A partir daí, cada visualização do painel passa a ter uma fonte de dados oficial, sincronizável e auditável — sem depender de mapeamentos hardcoded em `get-sheets-data` ou de URLs avulsas em `sheets_sources`.

## Como vai funcionar (visão do usuário)

1. Admin abre **Configurações → Fontes do Painel de Indicadores**.
2. Vê um card por meta (NPS & Reclamações, CMV Salmão, CMV Carnes, KDS, Conformidade, Visão Geral / Faturamento).
3. Para cada meta, pode:
   - Colar a URL da planilha (formato CSV `…/export?format=csv&gid=…`).
   - Dar um nome amigável e ativar/desativar.
   - Clicar **Sincronizar agora** ou **Testar conexão** (lê 1ª linha e mostra colunas detectadas).
   - Ver **última sincronização**, status (ok / erro / pendente) e nº de linhas.
4. No Painel de Indicadores, cada view passa a ler a fonte vinculada à sua meta. Se nenhuma fonte estiver vinculada, mostra estado vazio com link “Configurar fonte”.

## Mudanças no banco

Adicionar uma coluna `meta_key` em `sheets_sources` para amarrar cada fonte a uma meta do painel.

```sql
ALTER TABLE public.sheets_sources
  ADD COLUMN meta_key text;

CREATE UNIQUE INDEX sheets_sources_meta_key_unique
  ON public.sheets_sources(meta_key)
  WHERE meta_key IS NOT NULL AND ativo = true;
```

Valores aceitos para `meta_key` (validados no app, não no DB para flexibilidade): `nps`, `cmv-salmao`, `cmv-carnes`, `kds`, `conformidade`, `visao-geral`, `reclamacoes`.

Opcional (fase 2): adicionar `parser_type text` para indicar qual parser/edge function processa o CSV (`nps_v1`, `cmv_salmao_v1`, etc.).

## Mudanças no código

### 1. Nova seção em Configurações
- `src/components/sheets/MetaSheetsLinker.tsx` (novo) — lista as metas do painel (de `META_DEFINITIONS`) e renderiza um `MetaSourceCard` por meta.
- `MetaSourceCard`: exibe nome da meta, URL atual (mascarada), status, botões **Editar**, **Testar**, **Sincronizar**, **Remover**.
- Inserir `<MetaSheetsLinker />` em `src/components/ConfigurationsTab.tsx` (somente admin), acima da seção de “Lojas / Funções / Gerências”.

### 2. Hook
- Estender `src/hooks/useSheetsSources.ts`:
  - Tipo `SheetsSource` ganha `meta_key: string | null`.
  - Novo helper `useSourceForMeta(metaKey)` que retorna a fonte ativa daquela meta.
  - Mutation `linkSourceToMeta({ metaKey, url, nome })` faz upsert (1 fonte ativa por meta).

### 3. Edge function de teste/preview
- `supabase/functions/test-sheet-source/index.ts` (nova): recebe `{ url }`, baixa as primeiras ~5 linhas do CSV e devolve `{ headers, sampleRows, rowCount }`. Usada pelo botão **Testar conexão**.

### 4. Sincronização por meta
- Reaproveitar `sync-sheets-staging` (NPS/Reclamações) como está.
- Para CMV Salmão, CMV Carnes, KDS e Conformidade, criar (ou estender) uma função `sync-meta-sheet` que recebe `{ sourceId, metaKey }` e roteia para o parser certo. Nesta fase, basta o esqueleto + parser de NPS/Reclamações funcionando; os demais ficam stub com `TODO` até definirmos o layout das planilhas correspondentes.

### 5. Consumo no Painel
- Cada hook de view (`useReclamacoesData`, `useConformidadeData`, futuros `useCmvSalmaoData` etc.) ganha um fallback: se `useSourceForMeta(metaKey)` não retornar fonte vinculada, devolve `isEmpty=true` com flag `needsSource=true`.
- Componentes de view (`NpsReclamacoesView`, `CmvDetailView`, etc.) exibem um placeholder “Vincule uma planilha em Configurações → Fontes do Painel” quando `needsSource`.

## O que NÃO muda

- `MultiLinkSheetsSync` e `GoogleSheetsSync` continuam existindo (para imports avulsos / históricos). A nova seção é só para o vínculo **meta → planilha**.
- Estrutura visual do Painel de Indicadores (glassmorphism etc.) permanece.

## Entrega em fases

**Fase 1 (este ciclo):**
- Migration `meta_key`.
- UI `MetaSheetsLinker` + `MetaSourceCard` na aba Configurações.
- Hook estendido + mutation de vínculo.
- Edge function `test-sheet-source`.
- Vincular meta `nps` e `reclamacoes` ao fluxo já existente (`sync-sheets-staging`).

**Fase 2 (próximo ciclo, após validar layout das planilhas):**
- Parsers para `cmv-salmao`, `cmv-carnes`, `kds`, `conformidade`.
- Cron diário por meta (reaproveita `cron-import-sheets`).

## Perguntas a confirmar antes de implementar

1. As planilhas das metas **CMV Salmão**, **CMV Carnes**, **KDS** e **Conformidade** já existem hoje? Se sim, posso pedir um link de exemplo para definir o parser na Fase 2?
2. Posso assumir **uma planilha ativa por meta** (ao vincular nova, a anterior é desativada)? Ou você quer permitir múltiplas fontes empilhadas por meta?
