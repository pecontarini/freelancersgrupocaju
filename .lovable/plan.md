## Objetivo

Adicionar um botão de anexo no chat IA da Agenda do Líder que aceite **PDF, imagem (JPG/PNG/WEBP) e texto (TXT/MD)**. A IA usa o conteúdo extraído como contexto para sugerir missões — útil para colar uma auditoria, uma reclamação por print de WhatsApp, um relatório em PDF, etc.

## Como vai funcionar (visão do usuário)

1. No chat, ao lado do campo de texto, aparece um botão de clipe (📎) **"Anexar"**.
2. Ao clicar, abre o seletor de arquivos (até 3 anexos por mensagem, máx. 10 MB cada).
3. Os anexos aparecem como chips acima do textarea (com nome do arquivo, ícone do tipo e botão de remover).
4. O usuário pode escrever junto algo como _"Crie missões pra resolver os 3 pontos mais críticos dessa auditoria"_ e enviar.
5. A IA recebe o texto + o conteúdo dos arquivos e devolve missões estruturadas como já faz hoje.

## Como vai funcionar por trás

### Frontend — `MissoesChatView.tsx`
- Estado novo: `attachments: AttachmentDraft[]` (arquivo + texto extraído + tipo).
- Botão "Anexar" abre `<input type="file" multiple accept=".pdf,.txt,.md,image/*">`.
- **Extração no próprio navegador** (sem upload pra storage, mais rápido e privado):
  - **TXT/MD**: `file.text()` direto.
  - **PDF**: `pdfjs-dist` (já é leve via dynamic import) extrai todo o texto das páginas.
  - **Imagens**: convertidas em base64 e mandadas como `image_url` para o modelo (Gemini 3 Flash já é multimodal).
- Limite: 3 arquivos, 10 MB cada, ~50 mil chars de texto extraído (truncamento elegante com aviso).
- Os chips ficam visíveis até a resposta chegar e somem após `send()` com sucesso.
- A mensagem do usuário no histórico mostra "📎 nome-do-arquivo.pdf" inline pra ficar claro o que foi anexado.

### Edge function — `agenda-lider-chat`
- Aceitar nova forma de `messages[].content`: além de string, aceitar array OpenAI-style `[{type:"text",text:...}, {type:"image_url",image_url:{url:"data:..."}}]`.
- Quando vier anexo do tipo PDF/TXT, o frontend já manda o **texto extraído embutido no content** com cabeçalho `[Arquivo anexado: relatorio.pdf]\n\n<conteúdo>\n\n[/Arquivo]`.
- Quando vier imagem, o frontend manda como `image_url` (data URL base64). A função só repassa pro gateway — Gemini já lê.
- Ajuste no system prompt: instrução curta dizendo "Se houver arquivos anexados, priorize extrair os pontos críticos deles ao sugerir missões."
- Sem mudança em tabelas, storage ou config.

### Persistência
- O texto da mensagem do usuário salvo em `missao_chat` continua sendo só o que ele escreveu + lista dos nomes dos anexos (não o conteúdo cru, pra não inflar a tabela).
- Conteúdo extraído fica só na requisição da IA — perfeito porque é one-shot.

## Bibliotecas

- **`pdfjs-dist`** (~400 KB gzip, dynamic import só quando o usuário anexa um PDF — não pesa no bundle inicial).
- Imagens: `FileReader` nativo, sem libs.

## Casos de uso desbloqueados

- Anexar PDF de auditoria → "Crie missões pros 3 maiores ofensores"
- Anexar print do WhatsApp de uma reclamação → "Vire isso em plano de ação pro gerente"
- Anexar TXT exportado do checklist diário → "Resuma e me dê 2 missões prioritárias"
- Anexar foto de um problema operacional → "Identifique o problema e crie missão pra equipe certa"

## O que NÃO vai mudar

- Schema de banco (nada novo)
- Storage (não vou salvar os arquivos, são efêmeros)
- Visual e fluxo do chat existente (tudo continua igual, só ganha o botão e os chips)
- A função `agenda-lider-chat` mantém o mesmo contrato de saída (`{ text, missoes }`)

## Arquivos que vou tocar

1. `src/components/agenda-lider/chat/MissoesChatView.tsx` — botão, chips, extração, envio.
2. `src/components/agenda-lider/chat/AttachmentChip.tsx` — **novo**, componente do chip.
3. `src/lib/extract-attachment-text.ts` — **novo**, helper de extração (PDF/TXT/imagem).
4. `supabase/functions/agenda-lider-chat/index.ts` — aceitar content multimodal + ajuste no prompt.
5. `package.json` — adicionar `pdfjs-dist`.

Aprova que eu implemento?