# Organizar respostas da IA por tópicos com prazo, responsável e to-dos marcáveis

## O que muda na prática para o líder

Hoje o líder pode colar texto vindo de qualquer LLM (ChatGPT, Gemini, Claude…) ou anexar relatório, e a IA da Agenda devolve missões — mas tudo fica numa lista plana, sem agrupamento, e o "plano de ação" aparece só como leitura.

Depois deste ajuste, ao colar/anexar conteúdo o líder vai ver:

1. **Tópicos (categorias)** agrupando as missões — ex.: `CMV`, `Atendimento/NPS`, `Manutenção`, `Equipe/Escala`, `Auditoria`, `Outros`. Cada tópico vira uma seção colapsável no chat.
2. Dentro de cada tópico, **um card por missão** mostrando:
   - Título + prioridade (alta/média/baixa)
   - Responsável principal + co-responsáveis (chips)
   - Prazo formatado (dd/mm/aaaa)
   - **Checklist de to-dos** com caixinhas marcáveis (em vez de só uma lista de leitura)
   - Botão "Confirmar e criar missão" (cria no Quadro como hoje)
3. Um botão extra no topo de cada tópico: **"Confirmar todas deste tópico"** — para o líder não precisar clicar 1 a 1.

## Como o sistema vai garantir essa estrutura

### 1. Edge Function `agenda-lider-chat`
- Adicionar campo `topico` (string curta, max 30 chars, vinda de uma lista sugerida no prompt) na ferramenta `criar_missoes`.
- Reforçar o system prompt para:
  - Quando o usuário **colar texto longo de outra LLM** (detectar por tamanho > 800 chars ou estrutura tipo "1. … 2. …"), tratar como briefing já estruturado: extrair TODOS os itens acionáveis, não resumir.
  - SEMPRE preencher `prazo` (calculando a partir da prioridade: alta = +3 dias úteis, média = +7, baixa = +14) quando o usuário não informar.
  - SEMPRE escolher um `responsavel_user_id` da lista — só deixar vazio se realmente não houver cargo compatível.
  - SEMPRE devolver pelo menos 2 itens em `plano_acao` por missão (passos verificáveis, no formato "verbo + objeto").

### 2. Frontend — `MissoesPreviewCard.tsx`
- Adicionar estado local de checkboxes para cada item do `plano_acao` (visual no preview; ao confirmar, viram tarefas reais com `concluida = true/false` no banco).
- Trocar `<li>` por `<Checkbox>` shadcn + label.
- Mostrar prazo com destaque (badge âmbar se < 3 dias, vermelho se vencido).

### 3. Frontend — `MissoesChatView.tsx`
- Agrupar `m.missoes` por `topico` antes de renderizar.
- Cada grupo vira um bloco com:
  - Header do tópico + contador (ex.: "CMV · 3 missões")
  - Lista dos `MissoesPreviewCard` do grupo
  - Botão "Confirmar tudo deste tópico" → chama `confirmMissao` em sequência

### 4. Tipo `MissaoSugerida`
- Adicionar `topico?: string` (opcional, default "Outros").
- Tarefas no preview ganham estado `done: boolean` que é passado para `useMissoes.create` no array `tarefas`.

## Arquivos afetados
- `supabase/functions/agenda-lider-chat/index.ts` — schema da tool + prompt
- `src/components/agenda-lider/chat/MissoesPreviewCard.tsx` — checkboxes + badge de prazo
- `src/components/agenda-lider/chat/MissoesChatView.tsx` — agrupamento por tópico + confirmar em lote
- (sem mudanças de schema no banco — `tarefas_missao` já tem `concluida` e `dia_semana`)

## Fora de escopo
- Editar manualmente missão antes de confirmar (continua sendo "confirmar como veio" — pode ser próximo passo se você quiser).
- Reagrupar missões já criadas no Quadro por tópico (focado só na etapa de sugestão da IA agora).

Posso aplicar?
