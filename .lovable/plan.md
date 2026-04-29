## Objetivo

Permitir que o COO anexe o arquivo do POP (PDF, planilha Excel, imagem ou texto) dentro do POP Wizard. O IA lê o conteúdo, mapeia para os setores/dias/turnos da unidade e gera **automaticamente** uma proposta de Tabela Mínima já pré-preenchida no painel de diff, que o COO então só ajusta e aplica.

## Como vai funcionar (UX)

1. No drawer do POP Wizard, ao lado do botão **Enviar**, aparece um botão **"Anexar POP"** (ícone clipe/paperclip).
2. Ao clicar, abre seletor de arquivo aceitando: `.pdf`, `.xlsx`, `.xls`, `.csv`, `.txt`, `.md`, `.png`, `.jpg`, `.jpeg`, `.webp`. Limite: 10 MB, 1 arquivo por vez (o COO pode anexar mais em sequência).
3. Após selecionar:
   - Se for PDF/TXT/CSV/MD → extrai o texto no client (reusando `src/lib/extract-attachment-text.ts`).
   - Se for **Excel (.xlsx/.xls)** → usa `xlsx` (SheetJS, já presente no projeto via `src/lib/excelUtils.ts`) para serializar todas as abas como CSV/texto.
   - Se for imagem → envia como `data:URL` base64 multimodal para o Gemini.
4. Aparece um "chip" do anexo na área de chat (nome + tamanho + botão remover) e o input ganha um placeholder sugerindo o texto padrão "Use este POP anexado para preencher a Tabela Mínima desta unidade".
5. Ao clicar em **Enviar**, dispara automaticamente em **modo `validate`** (que é o modo onde a IA já pode chamar a tool no primeiro turno) para que ela pule a entrevista e gere direto a proposta com base no anexo. Se o usuário quiser conversar antes, é só digitar uma pergunta normal — o anexo continua disponível para a IA.
6. A proposta cai no painel de diff existente (`POPWizardPreview`), e o COO ajusta/aplica como já faz hoje.

## Mudanças técnicas

### Frontend

**`src/lib/extract-attachment-text.ts`**
- Adicionar suporte a Excel: novo branch `isExcel(file)` que usa `XLSX.read` + `XLSX.utils.sheet_to_csv` para todas as abas, concatenando como texto rotulado por aba (`--- Aba: NomeAba ---`). Aplicar o mesmo limite de `MAX_TEXT_CHARS` e flag `truncated`.
- Atualizar a mensagem de erro de "Tipo não suportado" para listar os novos formatos.

**`src/hooks/usePOPWizard.ts`**
- Adicionar estado `attachments: ExtractedAttachment[]` (array, mas inicialmente uso single anexo) + `addAttachment`, `removeAttachment`, `clearAttachments`.
- Em `sendMessage`, quando houver anexos:
  - Para cada anexo de texto: prefixar o `content` da mensagem do usuário com um bloco `## ANEXO: {name}\n{text}\n\n`.
  - Para anexos de imagem: enviar a mensagem do usuário como array multimodal (`[{type:"text",...},{type:"image_url",image_url:{url:dataUrl}}]`) em vez de string.
  - Forçar `effectiveMode = "validate"` quando há anexo na primeira mensagem (para a IA já gerar a proposta direto via tool, sem entrevista).
- Limpar anexos após o envio bem-sucedido.
- `reset()` também zera anexos.

**`src/components/escalas/holding/POPWizardDrawer.tsx`**
- Adicionar `<input type="file" hidden ref={fileRef} accept="...">` + botão `Paperclip` no rodapé, à esquerda do `Send`.
- Renderizar lista de chips de anexos acima do `Textarea` com nome + tamanho + botão `X` para remover.
- Estado de loading "Lendo arquivo…" enquanto `extractAttachment` roda; `toast.error` em caso de falha.
- Atualizar texto do card "Como funciona" para mencionar que dá pra anexar o POP e a IA preenche sozinha.
- Adicionar quick prompt novo: **"Anexar POP e preencher"** (apenas dispara o file picker; não envia mensagem).

### Backend (edge function `supabase/functions/pop-wizard-chat/index.ts`)

- Aceitar mensagens cujo `content` seja **string OU array** (formato OpenAI multimodal). O `RequestBody.messages[].content` passa a ser `string | Array<{type:"text",text:string} | {type:"image_url",image_url:{url:string}}>`.
- Acrescentar ao `systemPrompt` uma seção curta explicando: "Quando o usuário anexar um POP (texto ou imagem), use-o como fonte primária. Mapeie cada linha/turno do POP para os `sector_key` válidos da unidade. Se houver setor no POP que não existe na lista, IGNORE e mencione no `summary`. Se faltar dado para algum dia/turno, use bom senso operacional e marque no `reason` da célula que foi inferido. NÃO faça entrevista quando há anexo — gere a proposta direto na primeira resposta."
- Repassar as mensagens para o gateway exatamente como recebidas (já é compatível com `google/gemini-2.5-pro` multimodal).

### Validação / segurança

- Limite client-side: 10 MB por arquivo, 1 arquivo ativo por vez (substituível). Reusar `MAX_FILE_SIZE` de `extract-attachment-text.ts`.
- Bloquear envio enquanto extração está rodando.
- Nenhuma alteração de schema, RLS ou storage — anexo nunca é persistido, apenas trafega na requisição da edge function.

## Fora de escopo

- Persistir o POP anexado em Storage (não pedido).
- Versionar/comparar múltiplos POPs entre si.
- OCR avançado de PDFs escaneados (depende do que o `pdfjs` extrair; se vier vazio, fallback é tratar como imagem — o COO pode reanexar como JPG/PNG).
