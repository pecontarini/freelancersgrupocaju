
# Filtro estrito por unidade + Status em CAPS + Sync Google Calendar

Três melhorias na Agenda do Líder, todas focadas em precisão operacional do líder de cada loja.

## 1. Filtro estrito de membros por unidade

**Problema atual:** `useUnidadeMembros` usa fallback "se a unidade não tiver ninguém, mostra todos" (linha 71). Isso permite que o seletor — e a IA — atribua missões a funcionários de outras lojas.

**Solução:**
- Em `src/hooks/useUnidadeMembros.ts`: remover o fallback `return filtered.length > 0 ? filtered : all`. Quando `unidadeId` for fornecido, retornar **apenas** quem tem `profiles.unidade_id = unidadeId` OU registro em `user_stores` para essa loja. Admins continuam aparecendo apenas se vinculados explicitamente via `user_stores`. Se ninguém estiver vinculado, retorna lista vazia (com mensagem clara na UI).
- Adicionar nova flag opcional `includeAdmins?: boolean` (default `false`) — quando `true`, inclui usuários com role `admin` mesmo sem vínculo, útil só para o detalhe administrativo. Os formulários de criação de missão usam o default (`false`).
- Em `MissoesChatView.tsx`: já passa `available_users: membros` para a edge function, então automaticamente passa a enviar só os da loja. Adicionar guarda extra: filtrar no cliente antes de enviar, garantindo que mesmo que o cache traga algo a mais, só vai pra IA quem é da unidade selecionada.
- Em `supabase/functions/agenda-lider-chat/index.ts`: reforçar no system prompt — "NUNCA use um user_id que não esteja na lista de USUÁRIOS DISPONÍVEIS abaixo. Se a lista estiver vazia, deixe `responsavel_user_id` como string vazia."
- Em `NovaMissaoDialog.tsx` e `MissaoDetailDialog.tsx`: mostrar aviso "Nenhum membro vinculado a esta unidade — vincule no painel admin" quando `membros.length === 0`.

## 2. Status em CAPS LOCK

Em `src/components/agenda-lider/shared/Badges.tsx`, atualizar os labels do `STATUS_MAP`:
- "A Fazer" → "A FAZER"
- "Em Andamento" → "EM ANDAMENTO"  
- "Aguardando" → "AGUARDANDO"
- "Concluído" → "CONCLUÍDO"

E adicionar `tracking-wide` à classe do `StatusBadge` para padronizar visualmente. Como todos os usos do badge passam pelo helper, a mudança propaga para Quadro, Detalhe, Meu Painel e Diretoria automaticamente.

## 3. Sincronização com Google Agenda do líder

**Decisão de produto:** Google Tasks tem API limitada (sem sync de prazo, sem participantes). Vamos integrar direto com **Google Calendar** — cria um evento "all-day" no dia do `prazo` da missão, no calendário primário do líder responsável, com checklist do plano de ação na descrição. É o que dá melhor visibilidade no celular do líder.

**Infraestrutura existente já cobre:**
- OAuth completo com refresh_token persistente (`user_google_tokens`).
- Edge functions `google-oauth-start`, `google-oauth-callback`, `google-oauth-refresh` deployadas.
- Helpers `ensureValidGoogleToken()` e `createCalendarEvent()` em `src/services/googleCalendar.ts`.

**O que falta criar:**

### Migration
Adicionar à tabela `missoes`:
- `google_event_id text` — id do evento criado no Calendar
- `google_calendar_synced_at timestamptz` — última sincronização
- `google_calendar_user_id uuid` — qual líder dono do calendário (geralmente o responsável)

### Edge function nova: `sync-missao-to-calendar`
- Input: `{ missao_id }`.
- Resolve responsável da missão via `missao_membros` (papel `responsavel`).
- Busca token do responsável em `user_google_tokens`. Se não existir, retorna `{ status: "needs_connect", user_id }` para o frontend mostrar CTA.
- Renova token via lógica idêntica a `google-oauth-refresh` se expirado.
- Monta evento:
  - **Título:** título da missão em CAPS (já vem assim do banco/UI) com prefixo `[Caju]`.
  - **All-day** no `prazo` (1 dia).
  - **Descrição:** descrição + plano de ação como checklist em texto (`☐ tarefa 1\n☐ tarefa 2…`) + link de volta para o portal (`/?tab=agenda-lider&missao={id}`).
  - **Reminders:** 1 dia antes (popup) + 2h antes (popup).
  - **ColorId:** vermelho/amarelo/verde conforme prioridade.
- Se `google_event_id` já existir → `PATCH` no evento; caso contrário `POST` e salva o id retornado.
- Atualiza `google_event_id`, `google_calendar_synced_at`, `google_calendar_user_id` na missão.

### Hook frontend: `useSyncMissaoCalendar.ts`
- `mutation` que chama a edge function.
- Trata retorno `needs_connect`: dispara `startGoogleOAuth("/?tab=agenda-lider")` para o líder conectar (com toast explicando).
- Trata `GoogleAuthExpiredError` igual.

### UI

- **`MissaoDetailDialog.tsx`:** novo botão "Sincronizar com Google Agenda" no header, ao lado do Editar/Excluir. Ícone de calendário. Estado:
  - Se já sincronizado: mostra ✓ "Sincronizado em DD/MM HH:mm" + botão "Atualizar agenda".
  - Se não: botão "Adicionar ao Google Agenda".
  - Se responsável não tem token: toast "O líder responsável precisa conectar o Google" + botão de conectar (válido só se o usuário logado for o próprio responsável, senão só explica).
- **`MissoesPreviewCard.tsx` (chat):** checkbox opcional "Adicionar ao Google Agenda do responsável ao confirmar" — controlado por preferência por mensagem.
- **`MissoesChatView.tsx`:** após criar missão via `confirmMissao`, se a flag estiver ativa, dispara o sync.
- **`NovaMissaoDialog.tsx`:** mesmo checkbox no rodapé.

### Auto-sync na mudança de prazo (opcional, só se já estiver sincronizado)
Listener em `useMissoes.update` — quando `prazo` muda numa missão que tem `google_event_id`, dispara sync automático. Implementação simples: invalidar query + re-call do hook no Detail.

## Arquivos afetados

**Migration:** 1 nova (3 colunas em `missoes`).

**Criar:**
- `supabase/functions/sync-missao-to-calendar/index.ts`
- `src/hooks/useSyncMissaoCalendar.ts`

**Editar:**
- `src/hooks/useUnidadeMembros.ts` (filtro estrito)
- `src/components/agenda-lider/shared/Badges.tsx` (CAPS + tracking)
- `supabase/functions/agenda-lider-chat/index.ts` (reforço no prompt)
- `src/components/agenda-lider/chat/MissoesChatView.tsx` (filtro extra + flag sync)
- `src/components/agenda-lider/chat/MissoesPreviewCard.tsx` (checkbox sync)
- `src/components/agenda-lider/card/NovaMissaoDialog.tsx` (aviso vazio + checkbox sync)
- `src/components/agenda-lider/card/MissaoDetailDialog.tsx` (botão sync + status do sync)
- `src/integrations/supabase/types.ts` é regenerado automaticamente

Sem nova chave/secret — usa o `LOVABLE_API_KEY` (IA) e o OAuth Google que já está rodando.

Posso aplicar?
