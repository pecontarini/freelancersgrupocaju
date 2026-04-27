## Visão geral

Transformar a aba **Agenda** atual (calendário pessoal + Google Calendar) na **Agenda do Líder** — uma camada de governança colaborativa onde o proprietário descreve missões em linguagem natural, a IA estrutura em planos de ação, delega aos cargos certos e cada pessoa vê só o que importa pra ela. Tudo dentro da rota `/agenda` já existente, **preservando** o fluxo atual (eventos pessoais com sync Google) como uma sub-aba.

A entrega é um MVP completo de 4 telas (Chat IA, Board/Kanban, Card de Missão, Meu Painel) + visão Diretoria, com Realtime ligado.

## Como o usuário vai usar

1. Abre `/agenda` e vê 2 sub-abas: **Calendário** (atual) e **Missões** (novo).
2. Em **Missões**, vê 4 visualizações:
   - **Chat com IA** — descreve em texto livre o que precisa ("CMV do Caminito estourou…"). A IA responde com missões estruturadas, sugere responsável (com base no cargo) e cria o plano de ação em checklist. O usuário confirma e tudo vai pro board.
   - **Board** — Kanban (A Fazer / Em Andamento / Aguardando / Concluído) lado a lado com calendário semanal. Drag-and-drop entre colunas e dias.
   - **Meu Painel** — só missões delegadas a mim, com checklist do dia destacado.
   - **Diretoria** (admin/operator) — todas as missões de todas as unidades, com % de execução por responsável e por unidade.
3. Dentro de cada **Card de Missão**: título, descrição, responsável (1) e co-responsáveis (N) via `@menção`, prioridade (🔴🟡🟢), prazo, plano de ação como checklist, comentários em thread, anexos. Mudanças aparecem em tempo real para todos via Supabase Realtime.

## Arquitetura

### 1. Banco de dados (1 migração)

Novas tabelas (todas com RLS):

- **`missoes`**: `id, titulo, descricao, status` (`a_fazer | em_andamento | aguardando | concluido`), `prioridade` (`alta | media | baixa`), `unidade_id`, `criado_por`, `prazo`, `semana_referencia`, `created_at, updated_at`.
- **`missao_membros`**: `missao_id, user_id, papel` (`responsavel | co_responsavel`). PK composta. Único índice parcial garante 1 só `responsavel` por missão.
- **`missao_tarefas`** (checklist do plano de ação): `id, missao_id, descricao, dia_semana` (date opcional), `ordem, concluido, concluido_por, concluido_em`.
- **`missao_comentarios`**: `id, missao_id, user_id, texto, created_at`.
- **`missao_anexos`**: `id, missao_id, user_id, file_url, file_name, mime_type, created_at` (usa bucket novo `missao-anexos`).
- **`missao_chat`**: `id, user_id, semana_referencia, role` (`user | assistant`), `content, created_at` — histórico do chat com a IA, agrupado por semana.

**RLS** (usando `has_role` já existente):
- Admin/operator: full access em todas.
- Membro de uma missão (responsável ou co-resp): SELECT + UPDATE de tarefas/comentários, INSERT comentários/anexos.
- Criador da missão: full update/delete da missão.
- Gerente de unidade: SELECT em missões da própria `unidade_id`.

**Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE` para `missoes`, `missao_membros`, `missao_tarefas`, `missao_comentarios`.

**Storage**: bucket `missao-anexos` (privado, com policies por membro).

### 2. Edge Function de IA (`agenda-lider-chat`)

- Recebe: `{ messages: [...], unidade_id, available_users: [{user_id, nome, cargo}] }`.
- Modelo padrão: `google/gemini-3-flash-preview` via Lovable AI Gateway (sem API key adicional).
- **System prompt** com contexto Grupo CajuPAR (unidades, cargos típicos, exemplos de missões: CMV, contratação, plano de auditoria, escala).
- Usa **tool calling** com 1 ferramenta `criar_missoes` cujo schema retorna array de:
  ```
  { titulo, descricao, prioridade, prazo_sugerido, responsavel_user_id, 
    co_responsaveis: [user_id], plano_acao: [{descricao, dia_semana}] }
  ```
- A IA **sugere** mas **nunca grava direto** — devolve as missões estruturadas como JSON; o frontend mostra um preview "Confirmar/Editar/Descartar" e só aí persiste no banco.
- Streaming SSE para a resposta conversacional (texto antes do tool call).
- Trata 429/402 com mensagens claras.

### 3. Frontend (componentes novos)

```
src/pages/Agenda.tsx                      # adiciona sub-abas Calendário | Missões
src/components/agenda-lider/
  ├── AgendaLiderTab.tsx                  # container com 4 sub-views
  ├── chat/
  │   ├── MissoesChatView.tsx             # tela 1: chat com IA
  │   ├── MissoesPreviewCard.tsx          # preview antes de confirmar
  │   └── useAgendaLiderChat.ts           # hook de streaming
  ├── board/
  │   ├── MissoesBoardView.tsx            # tela 2: kanban + calendário
  │   ├── MissaoColumn.tsx                # coluna do kanban (dnd-kit)
  │   ├── MissaoCalendarLane.tsx          # faixa semanal pra arrastar
  │   └── MissaoCardCompact.tsx
  ├── card/
  │   ├── MissaoDetailDialog.tsx          # tela 3: dialog completo
  │   ├── MissaoMembrosSection.tsx        # @ menção + co-resp
  │   ├── MissaoChecklistSection.tsx      # plano de ação
  │   ├── MissaoComentariosThread.tsx
  │   └── MissaoAnexosSection.tsx
  ├── meu-painel/
  │   └── MeuPainelView.tsx               # tela 4
  ├── diretoria/
  │   └── DiretoriaView.tsx               # tela 5: agregados por unidade/responsável
  └── shared/
      ├── PrioridadeBadge.tsx
      ├── StatusBadge.tsx
      └── MentionAutocomplete.tsx         # @ usando profiles + cargo

src/hooks/
  ├── useMissoes.ts                       # CRUD + filtros + realtime
  ├── useMissaoTarefas.ts                 # checklist
  ├── useMissaoComentarios.ts
  ├── useMissaoMembros.ts
  └── useUnidadeMembros.ts                # lista usuários da unidade pra @ e delegação

supabase/functions/agenda-lider-chat/index.ts
```

Bibliotecas já presentes no stack — DnD via `@dnd-kit/core` (a instalar), motion via framer-motion (já usado).

### 4. Integração com sistema atual

- `useUserProfile` já fornece `isAdmin/isOperator/isGerenteUnidade/isChefeSetor/isEmployee` — usado pra rotear sub-views.
- `UnidadeContext` filtra missões por unidade selecionada (admin vê todas).
- Notificações: usa `sonner` (toast) no MVP. Push/WhatsApp fica fora deste plano (fase 2).

## Escopo desta entrega (MVP completo)

✅ Migração + RLS + Realtime + bucket de anexos
✅ Edge function de IA com tool calling e contexto CajuPAR
✅ Sub-aba **Missões** dentro de `/agenda` (Calendário continua intacto)
✅ Tela 1: Chat IA com preview e confirmação
✅ Tela 2: Board Kanban + faixa semanal com drag-and-drop
✅ Tela 3: Card de Missão com responsáveis, @-menção, checklist, comentários e anexos
✅ Tela 4: Meu Painel filtrado por usuário
✅ Tela 5: Visão Diretoria com agregados
✅ Realtime ligado em todas as views (mudança aparece pra todos)

## Fora deste escopo (fases futuras)

❌ Push notifications / WhatsApp via n8n
❌ Voz no chat (speech-to-text)
❌ Métricas históricas profundas / OKR
❌ Exportação PDF de missão

## Riscos e mitigações

- **IA sugerir responsável errado**: sempre confirmar antes de gravar; permitir edição inline no preview.
- **Permissões complexas**: começar com policies mais permissivas pra membros e endurecer depois com base no uso.
- **Volume de Realtime**: filtrar canais por `unidade_id` no client pra evitar broadcast global.
