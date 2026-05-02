## Objetivo

Aproveitar as fotos que já existem dentro do PDF da matriz e usá-las como imagem de identificação (`foto_url`) de cada utensílio criado, eliminando (ou reduzindo) a necessidade de gerar imagem por IA depois.

## Como vai funcionar (visão do usuário)

1. Você sobe o PDF normalmente em **Importar via PDF (IA)**.
2. A IA extrai os itens **e** as fotos lado a lado de cada item.
3. Cada linha do modal de revisão já aparece com a foto recortada do próprio PDF.
4. Ao confirmar, a foto é salva no bucket público de utensílios e vinculada ao item.
5. O botão "Gerar imagem com IA" continua disponível como fallback para itens onde a extração falhou.

## Como vai funcionar (técnico)

### 1. Edge Function `extract-utensilios-pdf` — passa a renderizar páginas

Hoje envia o PDF "cru" para o Gemini. Vamos mudar para:

- Renderizar cada página do PDF como **imagem PNG em alta resolução** usando `pdfium` (via `pdfium-deno` ou rasterização com `pdf-lib`+`canvas` no Deno). Alternativa robusta: `https://esm.sh/@pdf-lib/pdfium` ou usar a API `pdf.js-extract`. Avaliação: **usar `pdfium-deno`** (nativo, rápido, já roda em edge runtime).
- Mandar para o Gemini Flash a **imagem da página** (não mais o PDF) com instruções para retornar para cada item:
  ```
  { nome, qtd_minima, custo_unitario, fornecedor, setor,
    bbox: { x, y, w, h, page_index } }   // bbox em coordenadas normalizadas 0..1 da imagem
  ```
- Após receber a resposta, **recortar o bbox** de cada item da imagem renderizada (usando `Image` API do Deno ou `imagescript`) e fazer upload para o bucket `utensilios-photos` com o nome `imports/<uuid>.png`.
- Retornar para o frontend a `foto_url` pública já preenchida no campo existente da resposta.

### 2. Frontend (`UtensiliosImportPDFDialog.tsx`)

- O campo `foto_url` já existe em `ExtractedRow` e já é renderizado (linha 368-369). **Nenhuma mudança visual necessária** — basta receber o valor já preenchido pela edge function.
- Manter o botão "Gerar com IA" para itens cujo `foto_url` veio vazio.
- No `bulkImport`, a foto extraída já é gravada (linhas 211 e 231).

### 3. Bucket

`utensilios-photos` já existe e é público (visto no código de `generate-utensilio-image`). Sem migração necessária.

### 4. Observações de performance/custo

- Renderizar páginas em ~150 DPI mantém qualidade suficiente para fotos de produto pequenas e fica abaixo de 1MB por página.
- Mantém o paralelismo de 4 chunks. Cada chunk envia agora 6 imagens (uma por página) em vez de 1 PDF.
- O Gemini Flash multimodal aceita múltiplas imagens em uma chamada (`type: "image_url"`) — usaremos esse formato.
- Dedup atual por `nome+setor` continua válido; quando há duplicatas, mantemos a primeira foto encontrada.

## Arquivos afetados

```text
supabase/functions/extract-utensilios-pdf/index.ts   (refactor: render → crop → upload)
src/components/utensilios/UtensiliosImportPDFDialog.tsx   (nenhuma mudança esperada — já consome foto_url)
```

## Riscos / fallback

- Se a renderização do PDF falhar em alguma página, fazemos fallback para o fluxo atual (mandar PDF inteiro para a IA, sem foto).
- Se o bbox vier inválido (fora de 0..1), simplesmente deixamos `foto_url=null` e o usuário pode gerar via IA depois.

## O que você poderá testar logo após aprovar

1. Zerar Caju Itaim (já feito).
2. Subir o PDF novamente.
3. Cada item deve aparecer com foto **real do PDF** no modal de revisão.
4. Confirmar importação → fotos persistem no catálogo da unidade.
