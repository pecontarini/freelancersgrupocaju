## Objetivo

Hoje o POP Wizard responde imediatamente à primeira mensagem do usuário, podendo "viajar" na sugestão por falta de contexto. Vamos transformá-lo em uma **entrevista conversacional**: a IA faz UMA pergunta por vez até reunir contexto suficiente, e só então gera a proposta (que continua sendo revisada no painel de diff atual).

## Como vai funcionar (do ponto de vista do usuário)

1. Usuário abre o wizard e descreve em uma frase o que quer (ex: "Quero refazer os mínimos do salão").
2. A IA responde com **uma pergunta curta e específica** de cada vez, ex:
   - "Qual o seu objetivo principal: cobrir furos, otimizar custo ou redimensionar para um movimento novo?"
   - "Quais setores você quer ajustar? (todos, ou um subconjunto)"
   - "Quais dias da semana entram no escopo?"
   - "Almoço, jantar ou ambos?"
   - "Há restrição de efetivo (ex: não posso aumentar headcount)?"
   - "Algum dia/turno tem demanda atípica que devo considerar?"
3. Quando a IA julgar que tem contexto suficiente (mínimo ~3 perguntas respondidas, dependendo do escopo), ela emite a tool `propose_staffing_changes` direto — **sem pedir confirmação extra** — e o painel de diff já existente abre para revisão.
4. Usuário pode interromper a qualquer momento dizendo "pode propor agora" e a IA gera a proposta com o que tiver.

## Mudanças técnicas

### 1. `supabase/functions/pop-wizard-chat/index.ts` — reforçar o system prompt

Adicionar uma seção `## Protocolo de entrevista` que instrua o modelo a:

- Nunca propor mudanças na primeira resposta, exceto se o usuário pedir explicitamente ("pode propor direto", "gere agora", etc.).
- Fazer **UMA única pergunta por mensagem**, curta e objetiva.
- Cobrir, em ordem, estes eixos antes de propor (pular se já estiver claro pelo contexto/mensagens anteriores):
  1. Objetivo (cobrir furos / reduzir custo / redimensionar / criar do zero)
  2. Escopo de setores
  3. Escopo de dias da semana
  4. Escopo de turnos (almoço/jantar)
  5. Restrições (não aumentar headcount, manter dobras, etc.)
  6. Particularidades de demanda (eventos, sazonalidade)
- Reconhecer atalhos do usuário: "todos", "tudo", "qualquer", "você decide" → marcar o eixo como "livre" e seguir.
- Quando todos os eixos relevantes estiverem cobertos (ou usuário pedir para propor), chamar a tool `propose_staffing_changes` no MESMO turno em que entrega a proposta — sem pedir "confirma?".
- Manter regra: NUNCA chamar a tool enquanto ainda estiver perguntando.

Também ajustar o modo padrão: quando `mode === "wizard"`, forçar entrevista; em `"adjust"` e `"validate"`, manter comportamento atual (resposta direta) já que o usuário disparou um pedido pontual.

### 2. `src/hooks/usePOPWizard.ts` — ajuste mínimo

- Mudar o default de `sendMessage` para `mode: "wizard"` quando `messages.length === 0` (primeira mensagem inicia entrevista). Mensagens subsequentes herdam o modo da primeira interação até `reset()`.
- Guardar o modo da sessão em estado interno (`sessionMode`) para não alternar no meio da conversa.

### 3. `src/components/escalas/holding/POPWizardDrawer.tsx` — UX leve

- Adicionar um texto de boas-vindas inicial (mensagem assistente "fake" inserida no `reset`/abertura) explicando: *"Vou te fazer algumas perguntas curtas para entender o que você precisa antes de propor mudanças. Se quiser pular, diga 'pode propor agora'."*
- Adicionar um botão discreto **"Propor agora com o que temos"** abaixo do input, visível só durante a entrevista (quando ainda não há `proposed`), que envia a frase `"Pode propor agora com o contexto atual."` automaticamente.

### 4. Sem mudanças em

- `POPWizardPreview.tsx` (diff continua igual)
- `POPWizardButton.tsx` (gatilho continua igual)
- Banco de dados / RLS / migrations (nenhuma)

## Detalhes técnicos relevantes

- Tool calling continua com `propose_staffing_changes` — não muda o schema, então o painel de diff funciona sem alterações.
- Modelo continua `google/gemini-2.5-pro` (boa aderência a instruções de protocolo).
- Streaming SSE permanece igual.
- Nenhum secret novo necessário.

## O que NÃO vamos fazer (conforme suas respostas)

- Não criar formulário/cards estruturados antes do chat.
- Não adicionar etapa de "confirma o entendimento?" antes de propor — a IA propõe direto e você revisa no diff existente.
