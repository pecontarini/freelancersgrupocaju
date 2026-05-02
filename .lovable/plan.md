## Objetivo

Permitir vincular fotos aos utensílios depois da importação, de três formas:

1. **Segunda leitura do mesmo PDF** focada apenas em extrair imagens e cruzar com os nomes do catálogo.
2. **Galeria/Gerenciador de Fotos** — uma tela onde você vê todos os utensílios sem foto, pode subir manualmente ou gerar com IA (individual ou em lote).
3. **Botão "Gerar com IA"** já existe item-a-item; vamos adicionar **geração em massa** (todas as faltantes).

---

## 1. Nova edge function: `extract-utensilios-pdf-images`

Reutiliza o PDF já no bucket `utensilios-imports` (ou aceita upload novo) e roda o Gemini 2.5 Flash em modo multimodal pedindo apenas para mapear:

```
[
  { "nome": "Faca do Chef 8\"", "page": 3, "bbox": [x,y,w,h] | null, "image_b64": "..." }
]
```

Estratégia:
- Envia o PDF inteiro (`application/pdf` base64) para o gateway com prompt: *"Extraia cada item visível, retorne o nome impresso e os bytes da foto recortada como base64 PNG"*. Caso o modelo não devolva crops confiáveis, fallback para gerar imagem por IA (mesmo fluxo do `generate-utensilio-image`).
- Para cada item retornado, faz **fuzzy match** (mesmo `findBestMatch` já usado) contra `items_catalog` filtrado por `is_utensilio = true`.
- Faz upload do PNG no bucket `utensilios-photos` (já existe) e devolve a lista para revisão no front.

Saída: array `{ catalog_item_id, nome_pdf, foto_url, score }`.

## 2. Nova tela: "Galeria de Fotos" (aba dentro do módulo Utensílios)

Arquivo: `src/components/utensilios/GaleriaFotos.tsx` + entrada em `UtensiliosTab.tsx`.

Layout grid (cards):
- Filtro: "Sem foto" / "Com foto" / "Todos" + busca por nome + filtro por loja.
- Cada card: thumbnail (ou placeholder), nome, fornecedor, e três ações:
  - **Upload manual** (input file → bucket `utensilios-photos` → atualiza `items_catalog.foto_url`).
  - **Gerar com IA** (chama `generate-utensilio-image` existente).
  - **Substituir** (se já tem).
- Barra superior com 2 botões de ação em massa:
  - **"Importar fotos do PDF"** → abre dialog que sobe o PDF e chama `extract-utensilios-pdf-images`. Resultado entra em modal de revisão (similar ao import atual): preview lado a lado (foto extraída ↔ utensílio do catálogo), com toggle aceitar/rejeitar e seletor de match alternativo. Confirmar → bulk update em `items_catalog.foto_url`.
  - **"Gerar todas faltantes com IA"** → confirmação (`GERAR`), processa em fila com concorrência 3, barra de progresso, atualiza catálogo conforme termina. Trata erros 429/402 do gateway com toast.

## 3. Pequenos ajustes de suporte

- Hook `useUtensilios.ts`: adicionar `useUpdateUtensilioFoto(itemId, foto_url)` e `useBulkUpdateUtensilioFotos(payload[])`.
- `UtensiliosImportPDFDialog`: adicionar checkbox "Tentar extrair fotos do PDF" no Step 1 (chama a nova função em paralelo no Step 2 só para preencher `foto_url` antes da revisão). Opcional, sem bloquear.

## 4. Detalhes técnicos

```text
Fluxo Galeria:
[Listar items_catalog WHERE is_utensilio=true]
         │
   ┌─────┴─────────────────────────┐
   ▼                               ▼
[Upload manual]            [Importar PDF de fotos]
   │                               │
   ▼                               ▼
storage.utensilios-photos    edge: extract-utensilios-pdf-images
   │                               │
   ▼                               ▼
update items_catalog.foto_url    Modal revisão → bulk update
```

- Bucket `utensilios-photos` já é público — manter.
- RLS de `items_catalog`: já permite update para admin/gestor; nenhuma migração necessária.
- Sem alteração de schema.

## Arquivos a criar/editar

- **Criar** `supabase/functions/extract-utensilios-pdf-images/index.ts`
- **Criar** `src/components/utensilios/GaleriaFotos.tsx`
- **Criar** `src/components/utensilios/PdfPhotosReviewDialog.tsx`
- **Editar** `src/components/utensilios/UtensiliosTab.tsx` (nova aba "Fotos")
- **Editar** `src/components/utensilios/index.ts`
- **Editar** `src/hooks/useUtensilios.ts` (mutations de foto)
- **Editar** `src/components/utensilios/UtensiliosImportPDFDialog.tsx` (checkbox opcional de extrair fotos)

## Resultado esperado

- Você poderá importar o PDF de novo (somente para fotos) e o sistema cruza com o catálogo já existente.
- Ou abrir a aba "Fotos", clicar em **"Gerar todas faltantes com IA"** e em poucos minutos todos os utensílios sem imagem ganham uma foto.
- Ou subir manualmente foto a foto pelos cards.