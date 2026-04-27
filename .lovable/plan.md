
# IA CMV Carnes — Diagnóstico de Desvio + Plano de Ação na Agenda

## Visão Geral

Adicionar uma aba **"IA CMV"** dentro de `CMVTab.tsx` com um copiloto focado em **três coisas, e só essas três**:

1. **Análise de desvio** — explicar em PT-BR onde, quando e por quê o real ≠ teórico, cruzando contagens diárias e por turno (Câmara / Praça).
2. **Diagnóstico de contagens** — apontar contagens suspeitas (turno X turno, dia X média histórica), turnos/dias com maior desvio recorrente, itens críticos.
3. **Plano de ação automático na Agenda do Líder** — gerar uma **Missão** (com tarefas, responsável, prazo e prioridade) já vinculada ao gerente da unidade, sem sair da tela.

Sem sugestão de compras (envio é automático). Sem chat genérico — escopo travado em desvio + contagens + ação.

---

## Onde a IA agrega valor

| Frente | O que a IA faz | Resultado prático |
|---|---|---|
| **Resumo da semana** | Sintetiza top 5 itens com maior desvio (kg + R$), turno predominante, comparativo com semana anterior | Gerente vê o "raio-X" em 1 clique |
| **Por que desviou?** | Cruza desvio do item com contagens por turno (Câmara entrada/saída + Praça abertura/fechamento), entradas e vendas teóricas | Aponta o turno/dia/etapa onde a perda começou |
| **Contagens suspeitas** | Marca contagens com variação >X% vs média 14d, ou onde Câmara saída ≠ Praça entrada do mesmo dia | Detecta erro de contagem antes da auditoria |
| **Padrões recorrentes** | "Picanha desvia toda SEX no turno noite há 3 semanas" | Direciona ação corretiva ao alvo certo |
| **Plano de ação** | Gera Missão com tarefas específicas (ex: "Refazer treinamento de porcionamento de Picanha — Chefe Parrilla — prazo 7d") | Vai direto para a Agenda do Líder com responsável e prazo |

---

## Arquitetura

```text
┌──────────────────────────────────────────────┐
│  CMVTab.tsx  → nova aba "IA CMV"             │
│   └─ CMVAIAssistant.tsx                      │
│       ├─ Cards de quick actions              │
│       ├─ Chat (markdown, streaming)          │
│       └─ Card "Plano de Ação Sugerido"       │
│           → botão "Criar Missão na Agenda"   │
└────────────────┬─────────────────────────────┘
                 │ supabase.functions.invoke
                 ▼
┌──────────────────────────────────────────────┐
│ Edge Function: cmv-ai-assistant (SSE)        │
│  1. Valida JWT + acesso à unit_id            │
│  2. Monta CONTEXTO da unidade (compacto):    │
│     - 18 itens carnes + custo                │
│     - cmv_contagens (últimos 14 dias)        │
│     - cmv_camara + cmv_praca (turnos)        │
│     - calculate_audit_period(7d e 30d)       │
│     - cmv_vendas_desvio (resumo)             │
│  3. System prompt restritivo (escopo CMV)    │
│  4. Stream → Lovable AI Gateway              │
│     model: google/gemini-3-flash-preview     │
│  5. Tools:                                   │
│     - flag_contagem_suspeita(item, data,...) │
│     - propor_plano_acao({titulo, tarefas,    │
│           prazo, prioridade, responsavel})   │
└──────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────┐
│  Ao clicar "Criar Missão na Agenda":         │
│  useMissoes.create({                         │
│    titulo, descricao, prioridade, prazo,     │
│    unidade_id: effectiveUnidadeId,           │
│    tarefas: [...],                           │
│    membros: [{user_id: gerente, papel:       │
│              'responsavel'}]                 │
│  })  → aparece na Agenda do Líder            │
└──────────────────────────────────────────────┘
```

---

## Quick Actions (botões prontos)

1. **"Resumo do desvio da semana"** — 7 dias, top 5 itens, turno crítico, R$ perdido.
2. **"Onde está o desvio da [item]?"** — seleciona 1 item, IA disseca turno a turno.
3. **"Contagens suspeitas (últimos 14 dias)"** — lista contagens fora da curva.
4. **"Gerar plano de ação para [item / problema]"** — produz Missão pronta para a Agenda.

---

## Fluxo de uma análise (exemplo real)

1. Gerente em **Caju Limão** clica **"Resumo do desvio da semana"**
2. Edge function coleta: contagens diárias + turnos câmara/praça + audit period 7d
3. IA responde via stream:
   > "Top desvio: **Picanha** −2,8 kg (≈ R$ 392). Padrão: ocorre na **saída da Câmara para Praça** nos turnos da **noite (QUI/SEX/SAB)**. Praça abre coerente (4,1 kg) e fecha 1,3 kg (esperado 2,9 kg). Sugiro investigar porcionamento e descarte de aparas no turno noite."
4. Junto, aparece card **"Plano de Ação Sugerido"** com:
   - Título: *Auditoria de porcionamento Picanha — turno noite*
   - Prioridade: Alta
   - Prazo: 7 dias
   - Tarefas: (1) Pesar 5 peças aleatórias no recebimento da câmara → praça; (2) Treinar equipe noite no POP de aparas; (3) Registrar descarte em ficha específica por 7 dias
   - Responsável sugerido: Gerente da unidade (editável)
5. Botão **"Criar Missão na Agenda"** → grava em `missoes` + `missao_tarefas` + `missao_membros` → aparece na Agenda do Líder.

---

## Estrutura de arquivos

**Criar:**
- `src/components/cmv/CMVAIAssistant.tsx` — UI: chat, quick actions, card de plano de ação, botão de criar missão
- `src/components/cmv/CMVActionPlanCard.tsx` — card que renderiza o plano sugerido com edição inline antes de salvar
- `src/hooks/useCMVAIContext.ts` — coleta contexto compacto da unidade (carnes + contagens + turnos + auditoria 7d/30d)
- `supabase/functions/cmv-ai-assistant/index.ts` — edge function streaming SSE com tool calling

**Editar:**
- `src/components/dashboard/CMVTab.tsx` — adicionar 9ª aba "IA" (ícone `Sparkles`)

**Reutilizar (sem alterar):**
- `useCMVItems`, `useCMVContagens`, `useCMVVendasDesvio`, `useCMVAnalytics`
- `useMissoes.create()` — para gravar o plano de ação na Agenda
- `useUnidadeMembros` — para sugerir responsável (gerente da unidade)
- RPCs existentes: `calculate_audit_period`, `compute_kardex_daily`, `get_realtime_stock_positions`

---

## Restrições e segurança

- **Escopo travado**: system prompt instrui a IA a **só** falar sobre desvio/contagens de carnes da unidade enviada. Pergunta fora de escopo recebe resposta padrão de recusa.
- **Sem invenção de números**: prompt exige que toda métrica citada venha do contexto enviado; se não tiver dado, responder "sem dados suficientes".
- **Sem escrita automática**: a IA propõe o plano, mas a gravação na Agenda só ocorre após clique explícito do usuário (padrão `architecture/data-import-confirmation-standard`).
- **Unidade isolada**: edge valida que `unit_id` enviado pertence ao usuário (`user_has_access_to_loja`).
- **RLS Missões**: o plano é criado com `unidade_id = effectiveUnidadeId` e `criado_por = auth.uid()`, respeitando policies já existentes.
- **Sem emojis na UI** — `Sparkles`, `Lightbulb`, `AlertTriangle`, `ListChecks` (lucide-react).
- **Mobile-first**: chat ocupa altura total no mobile; desktop usa duas colunas.
- **Datas YYYY-MM-DD** (mem `technical/date-handling-standard`).
- **Tratamento 429/402** do Lovable AI Gateway com toast amigável.

---

## Detalhes técnicos

- **Modelo**: `google/gemini-3-flash-preview` (default) — bom para tabelas pequenas e respostas rápidas.
- **Streaming**: SSE line-by-line (padrão já usado em `agenda-lider-chat` e `gerar-escala-ia`).
- **Contexto**: ~5–8 KB de JSON compacto enviado por requisição (14 dias × 18 itens × campos essenciais).
- **Tool calling** para saídas estruturadas:
  - `propor_plano_acao` retorna `{titulo, descricao, prioridade, prazo_dias, tarefas: string[], item_relacionado, turno_critico}` → renderizado no `CMVActionPlanCard`.
  - `flag_contagem_suspeita` retorna `{item_id, data, turno, valor_observado, valor_esperado, motivo}` → exibido como lista de alertas.
- **Histórico** de chat: mantido em estado React durante a sessão (sem persistência, alinha com diretriz "não persistir sem pedido explícito"). Pode virar persistente em iteração futura.

---

## Entregáveis desta iteração

1. Aba **"IA CMV"** dentro do CMV Unitário com chat e 4 quick actions focadas em desvio.
2. Edge function `cmv-ai-assistant` com streaming + tool calling para plano de ação e flags de contagem.
3. Card **"Plano de Ação Sugerido"** editável + botão **"Criar Missão na Agenda do Líder"** que grava em `missoes` com tarefas e responsável.
4. Lista de **contagens suspeitas** quando a IA detectar variação anormal.

**Fora do escopo desta iteração** (futuras melhorias):
- Validação inline durante a digitação da contagem
- Histórico persistente de conversas
- Notificação automática (push/WhatsApp) quando IA detectar desvio crítico
- Acompanhamento do efeito do plano de ação (antes/depois)

---

Posso seguir com a implementação?
