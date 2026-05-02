## Diagnóstico

A edge function `extract-utensilios-pdf` aparece nos logs **apenas como "booted"** — nenhuma requisição HTTP completa foi registrada no edge_logs. Combinado com a UI presa em "Extraindo com IA…", isso indica que **a requisição nem está chegando à função** ou está travando antes da resposta. Causas mais prováveis:

1. **Payload excede o limite (~6MB) de body em Edge Functions.** O PDF do usuário tem 21 páginas. Convertido para base64 e embrulhado em JSON, facilmente passa de 8-15MB. O Supabase Functions Gateway corta antes de invocar a função — por isso vemos "booted" mas nenhum log de execução.
2. **Gemini 2.5 Pro processando 21 páginas** pode levar 90-180s. Mesmo se o payload passar, a função pode estourar o timeout padrão (60s) do edge runtime, e o cliente fica preso indefinidamente.
3. **Sem timeout client-side** — `supabase.functions.invoke` não tem timeout, então a UI roda para sempre.

## Solução

### 1. Mudar transporte do PDF: Storage em vez de base64 inline
- Criar bucket privado `utensilios-imports` (ou reutilizar um existente).
- No client: upload do PDF para Storage → obter `path`.
- Passar para a edge function apenas `{ pdf_path: "<path>" }` (payload < 1KB).
- Edge function baixa o PDF do Storage com Service Role e converte para base64 internamente para enviar ao Gemini.

### 2. Trocar modelo para `gemini-2.5-flash` + processar em chunks
- Gemini 2.5 Flash é 5-8x mais rápido e suficiente para extração tabular estruturada.
- Para PDFs > 10 páginas: dividir em chunks de 10 páginas (usando `pdf-lib` no Deno) e processar em paralelo.
- Mesclar resultados e deduplicar por nome+setor.

### 3. Logs e timeouts robustos
- Adicionar `console.log` em cada etapa-chave da edge function (download size, chunk count, AI response status, items extraídos).
- No client: `Promise.race` com timeout de 180s + mensagem de erro clara.
- Toast de progresso ("Página X de Y processada") via polling opcional ou apenas mensagens intermediárias.

### 4. Correção de config
- Manter `verify_jwt = true` (default) — admins já estão autenticados, e essa é a postura segura.
- Confirmar que `LOVABLE_API_KEY` está disponível (já está, pela `generate-utensilio-image` ter funcionado).

## Arquivos afetados

- **`supabase/functions/extract-utensilios-pdf/index.ts`** — refatorar para receber `pdf_path`, baixar do Storage, dividir em chunks, processar paralelo, logs detalhados, modelo flash.
- **`src/components/utensilios/UtensiliosImportPDFDialog.tsx`** — `handleExtract` faz upload para Storage primeiro, depois chama a function com `pdf_path`. Adicionar timeout de 180s e mensagens de progresso.
- **Migration nova** — criar bucket `utensilios-imports` (privado) com policy permitindo apenas admins fazerem upload e a service role ler.

## Como vai ficar o fluxo

```text
[Client]
  1. Upload PDF -> Storage (utensilios-imports/{uuid}.pdf)
  2. invoke('extract-utensilios-pdf', { pdf_path })   [payload <1KB]

[Edge Function]
  3. Service-role client baixa PDF do Storage
  4. pdf-lib divide em chunks de 10 páginas
  5. Para cada chunk: chama Gemini 2.5 Flash com tool-call estruturada
  6. Mescla + deduplica itens
  7. (Opcional) deleta o PDF do bucket
  8. Retorna { items: [...] }

[Client]
  9. Mostra revisão (passo 2 do wizard)
```

## Verificação pós-deploy

- Testar com o PDF de 21 páginas que o usuário tentou.
- Conferir logs da edge function via `supabase--edge_function_logs` (devem mostrar download size, chunk count, item count).
- Confirmar que a UI sai do estado "Extraindo…" em < 90s.
