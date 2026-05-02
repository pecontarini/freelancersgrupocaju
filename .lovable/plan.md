
## Objetivo

Permitir que o usuário faça upload de um PDF (como o `ESTOQUE_MINIMO_CAJULIMAO_AN.pdf`) e que o sistema:

1. **Extraia** todos os utensílios (nome, qtd. mínima, custo, fornecedor, setor, e foto quando houver).
2. **Mostre uma tela de revisão** com matching contra o catálogo existente (229 utensílios hoje).
3. **Aplique** os mínimos em **uma ou várias lojas selecionadas**, em uma única operação.
4. **Salve a foto do item** no catálogo, para reaproveitar em futuras criações.
5. **Busque automaticamente** uma imagem de referência via web (Google Images / IA) quando o item for novo e não houver foto no PDF.

---

## Fluxo de uso (operacional)

```text
[Usuário admin abre aba Utensílios]
        │
        ▼
[Botão novo: "Importar PDF de Estoque Mínimo"]
        │
        ▼
[Upload do PDF + seleção de 1..N lojas alvo]
        │
        ▼
[Edge Function processa o PDF com IA (Gemini 2.5 Pro multimodal):
   - extrai linhas: nome, qtd_min, custo, fornecedor, setor
   - extrai imagens recortadas de cada item]
        │
        ▼
[Modal de Revisão obrigatório]
   - Cada linha mostra: nome PDF → match no catálogo (autocomplete editável)
   - Status: ✓ match exato | ~ similar | + criar novo | ✗ ignorar
   - Foto: thumb extraída do PDF + opção "buscar foto na web"
   - Resumo: X serão atualizados, Y serão criados, Z lojas alvo
        │
        ▼
[Confirmação textual "IMPORTAR" para liberar o botão]
        │
        ▼
[Persistência em batch:
   1. Cria items_catalog novos (com foto_url já no bucket)
   2. Faz upsert utensilios_items (catalog_item_id × loja_id) para cada loja
   3. Atualiza preco_custo no catálogo se vier no PDF]
        │
        ▼
[Toast: "X itens aplicados em Y lojas"]
```

---

## Detalhes técnicos

### 1. Banco de dados (migration)

Adicionar ao `items_catalog`:
- `foto_url TEXT` — URL pública da foto de referência
- `fornecedor_sugerido TEXT` — fornecedor padrão (opcional, do PDF)

Criar bucket `utensilios-photos` público (mesma estratégia de `audit-photos`), com policy de upload restrita a usuários autenticados (admin/operator/gerente).

### 2. Edge Function `extract-utensilios-pdf`

- Recebe: PDF em multipart/form-data + lista de `loja_ids`.
- Usa **Lovable AI Gateway** com `google/gemini-2.5-pro` (multimodal, sem custo de chave externa) para extrair linhas estruturadas via tool calling com schema:
  ```json
  { "items": [{ "nome", "qtd_minima", "custo_unitario",
                "fornecedor", "setor", "tem_foto" }] }
  ```
- Em paralelo, usa `pdf-lib`/`pdfjs` para extrair as imagens embutidas página a página e associa por proximidade (mesma técnica usada no parsing do PDF).
- Retorna JSON com `items` + `images[]` (base64) prontos para o modal de revisão.

### 3. Edge Function `fetch-utensil-reference-image` (opcional)

- Para itens novos sem foto no PDF, faz busca por imagem usando Gemini 2.5 Pro com URL context ou Google Custom Search (se configurado) e devolve uma URL candidata para o usuário aceitar/rejeitar.
- Se o usuário aceitar, baixamos e subimos para o bucket `utensilios-photos`.

### 4. Componente `UtensiliosImportPDFDialog.tsx`

Novo componente acionado por botão na `UtensiliosTab` (visível só para admin), com 3 etapas:

1. **Upload + lojas alvo** (multi-select de `config_lojas` com chips marcáveis).
2. **Revisão** (tabela com nome PDF / match catálogo / setor / qtd mín / custo / foto). Reusa o padrão de `BulkImportExport.tsx` (Accordion + Badge `isNew`/`isValid`).
3. **Confirmação** com input de texto "IMPORTAR" (padrão do projeto para ações destrutivas/em massa).

### 5. Matching nome → catálogo

- Reusa `src/lib/fuzzyMatch.ts` (já existe) para sugerir o melhor match com score.
- Threshold ≥ 0.85: marca como match automático.
- Entre 0.6 e 0.85: mostra sugestão mas pede confirmação manual.
- < 0.6: oferece "criar novo no catálogo".

### 6. Persistência

Reusa exatamente o `useBulkImportUtensiliosItems` (que já faz upsert em batches de 500 com `onConflict: catalog_item_id,loja_id`). A diferença é que a chamada será expandida: para cada item, gera uma linha por loja selecionada (cartesiano `items × lojas`).

---

## Arquivos a criar/editar

**Criar:**
- `supabase/functions/extract-utensilios-pdf/index.ts` — extração via Gemini multimodal
- `supabase/functions/fetch-utensil-reference-image/index.ts` — busca foto na web (opcional)
- `src/components/utensilios/UtensiliosImportPDFDialog.tsx` — wizard 3 etapas
- `src/hooks/useUtensiliosPdfImport.ts` — orquestração (extract → review → upsert)

**Editar:**
- `src/components/utensilios/UtensiliosTab.tsx` — adicionar botão "Importar PDF" no card "Gestão da Rede" (só admin)
- `src/hooks/useUtensilios.ts` — pequeno helper `useCreateCatalogItem` para itens novos
- Migration SQL para `items_catalog.foto_url` + bucket `utensilios-photos` + RLS

---

## Pontos abertos para confirmação rápida

(Vou perguntar ao final, não bloqueia o plano)

- Aceita usar **Gemini 2.5 Pro via Lovable AI** (sem chave externa, já contabilizado no projeto)?
- Para **busca automática de imagem na web**: aceitável usar a própria IA (Gemini com URL context) e o usuário valida no modal? Ou prefere conectar Google Custom Search (precisa de API key)?
- Para o multi-loja: aceitável copiar **os mesmos mínimos** para todas as lojas marcadas, ou quer que cada loja tenha um fator multiplicador (ex.: Itaim = 80% do Asa Norte)?
