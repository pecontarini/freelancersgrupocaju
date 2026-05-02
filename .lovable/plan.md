## Problema

A função `extract-utensilios-pdf` está crashando no boot com:

```
event loop error: The argument 'filename' must be a file URL object...
Received https://esm.sh/mupdf@1.3.0/denonext/mupdf.mjs
at createRequire (node:module:852:13)
```

Causa: o pacote `mupdf` (importado de `esm.sh`) usa internamente `node:module createRequire` passando uma URL remota — operação não suportada pelo runtime do Supabase Edge Functions (Deno). Por isso o frontend recebe **"Failed to send a request to the Edge Function"** ao clicar em importar o PDF.

## Solução

Substituir `mupdf` pelo **`pdfium-deno`** (`https://deno.land/x/pdfium/...`) — uma binding WASM do PDFium que **roda nativamente no Deno** sem `createRequire`. Já vi o comentário no topo do próprio arquivo dizer "Renders each page to PNG via pdfium-deno" — a intenção original era essa, mas a implementação acabou usando mupdf.

Alternativa de fallback caso pdfium-deno tenha problemas: usar `pdf-lib` + renderização por canvas WASM, ou enviar o PDF diretamente como `application/pdf` para o Gemini (que aceita PDFs nativamente como input multimodal) — eliminando totalmente a etapa de rasterização local.

### Plano recomendado: enviar PDF direto ao Gemini

Mais simples, mais robusto e elimina a dependência problemática:

1. **Remover** o import de `mupdf` e a função `renderAllPages`.
2. **Enviar o PDF diretamente** ao Gemini como `image_url` com `data:application/pdf;base64,...` (o gateway Lovable + Gemini 2.5 Flash aceita PDFs como input).
3. **Manter o fluxo de bbox**: pedir à IA bbox normalizado por página + `page_index`.
4. **Para o crop das fotos**: como não temos mais o raster local, renderizar **somente as páginas que têm itens com bbox válido** usando `pdfium-deno` (lazy + apenas as necessárias). Se o pdfium-deno também falhar, fazer fallback para pular o crop e usar `generate-utensilio-image` (já existe no projeto) para gerar imagens via IA.

### Plano alternativo (se quiser manter raster + fotos cortadas)

Trocar `mupdf` por:
```ts
import { PDFiumLibrary } from "https://deno.land/x/pdfium@v1.x/mod.ts";
```
e adaptar `renderAllPages` para usar essa API (`library.loadDocument`, `document.getPage(i).render({ scale })`).

## Arquivos a alterar

- `supabase/functions/extract-utensilios-pdf/index.ts` — substituir mupdf, ajustar `renderAllPages` ou remover e enviar PDF direto à IA.

## Validação

1. Deploy da função.
2. Verificar logs (`supabase--edge_function_logs extract-utensilios-pdf`) — não deve mais aparecer o erro de `createRequire`.
3. Testar upload do PDF do Caju Itaim na UI — modal deve avançar para a etapa "2. Revisar" com a lista de itens extraídos.

## Recomendação

Sigo com o **plano recomendado** (enviar PDF direto ao Gemini) porque:
- Elimina a dependência problemática que já falhou duas vezes.
- Reduz tempo de processamento (sem rasterização local).
- Gemini 2.5 Flash tem suporte nativo a PDFs e geralmente extrai melhor de PDFs vetoriais do que de imagens rasterizadas.
- Mantém o crop de fotos via lazy-render só quando necessário.

Confirma para eu implementar?
