## Objetivo
Permitir colar qualquer link de planilha Google (formatos `/edit`, `/edit#gid=`, `/view`, `/export?format=csv`, `/gviz/tq`) no vínculo de metas. O sistema converte automaticamente para o CSV canônico antes de salvar/testar.

## Mudanças

### 1. `src/hooks/useSheetsSources.ts`
- Adicionar `extractSheetId(url)` e `extractGid(url)` (helpers internos).
- Adicionar `normalizeSheetsUrl(url)` exportado: devolve sempre `https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}`. URLs `gviz/tq` são preservadas.
- Simplificar `validateSheetsCsvUrl`: aceita qualquer URL `docs.google.com/spreadsheets/d/...` desde que tenha ID.
- `parseSheetsCsvUrl` passa a usar os helpers (aceita qualquer formato).
- Em `createSource`, `updateSource` e `linkSourceToMeta`: chamar `normalizeSheetsUrl(input.url)` antes do insert/update — o que vai pro banco é sempre CSV canônico.

### 2. `src/components/sheets/MetaSheetsLinker.tsx`
- Atualizar `DialogDescription`: "Cole o link da planilha (qualquer formato — `/edit`, `/view` ou `/export`). Convertemos automaticamente para CSV. Compartilhe como 'Qualquer pessoa com o link'."
- Abaixo do input URL, mostrar preview da URL CSV gerada via `normalizeSheetsUrl(url)` quando válida: `→ vai ler: …/export?format=csv&gid=N`.
- `handleTest` e `handleSave` usam `normalizeSheetsUrl(url)` antes de chamar a edge function / mutation.
- Texto do placeholder atualizado para mostrar exemplo `/edit#gid=0`.

### 3. `supabase/functions/sync-sheets-staging/index.ts`
Defesa em profundidade: replicar `normalizeSheetsUrl` no servidor e aplicar ao `url` recebido antes do regex de validação. Se chegar um link `/edit`, ele é convertido lá também antes do `fetch`.

## Restrições
- Banco: nenhuma alteração de schema.
- Rotas: nenhuma.
- Outras telas: nenhuma.
- Pré-requisito de compartilhamento da planilha ("Qualquer pessoa com o link → Visualizador") permanece — o botão **Testar conexão** continua sendo a verificação.
