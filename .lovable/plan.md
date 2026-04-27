
# Botão "+ Nova missão" funcional + Padronização CAPS LOCK

## 1. Modal de criação manual de missão

Hoje o botão "+ Nova missão" em `MissoesBoardView.tsx` abre apenas um `prompt()` nativo do navegador pedindo só o título. Vou substituir por um modal completo, no mesmo padrão visual do `MissaoDetailDialog`.

**Novo componente: `src/components/agenda-lider/card/NovaMissaoDialog.tsx`**

Campos do formulário:
- **Título** (obrigatório) — Input
- **Descrição** — Textarea
- **Tópico** — Input livre (ex: CMV, Manutenção, NPS) para alinhar com o agrupamento já usado pelo Chat IA
- **Prioridade** — Select (Alta / Média / Baixa, default Média)
- **Status inicial** — Select (A fazer / Em andamento / Aguardando, default A fazer)
- **Prazo** — Input date (com cálculo automático sugerido se vazio: Alta +3d, Média +7d, Baixa +14d, igual à lógica do edge function)
- **Responsável** — Select com membros da unidade (`useUnidadeMembros`); default = usuário logado
- **Co-responsáveis** — Multi-select (chips com X) dos demais membros
- **Plano de ação (tarefas)** — Lista editável: input + botão "Adicionar tarefa", cada item com X para remover

Ao confirmar:
- Chama `create.mutateAsync()` do `useMissoes` passando `titulo`, `descricao`, `prioridade`, `status`, `prazo`, `unidade_id`, `membros[]` e `tarefas[]` (o hook já suporta tudo isso).
- Toast de sucesso e fecha o modal.

**Edição em `MissoesBoardView.tsx`:**
- Remover a função `quickCreate()` baseada em `prompt()`.
- Adicionar `const [openNew, setOpenNew] = useState(false)` e abrir o novo dialog ao clicar em "+ Nova missão".

## 2. Padronização CAPS LOCK nos títulos das missões

**Estratégia:** aplicar uppercase via CSS (`uppercase` do Tailwind) nos pontos de exibição, sem alterar os dados do banco. Assim:
- Funciona retroativamente para missões já criadas.
- Preserva o texto original caso queiramos reverter.
- Cobre tanto missões criadas pelo Chat IA quanto manualmente.

**Arquivos a ajustar (apenas a classe do título):**
- `src/components/agenda-lider/board/MissaoCardCompact.tsx` — `<h4>` do título → adicionar `uppercase tracking-wide`
- `src/components/agenda-lider/card/MissaoDetailDialog.tsx` — `<span className="text-lg">` do título → adicionar `uppercase tracking-wide`
- `src/components/agenda-lider/chat/MissoesPreviewCard.tsx` — `<h4>` da prévia → adicionar `uppercase tracking-wide`
- `src/components/agenda-lider/meu-painel/*` (cards de "Minhas missões", se existirem) — aplicar mesma classe nos títulos

Vou inspecionar `meu-painel/` na implementação para garantir que todos os pontos de exibição do título recebam o tratamento.

**Observação:** descrições, tópicos e tarefas continuam em case normal — apenas o **título** vai em CAPS, conforme solicitado para destacar nos cards.

## Arquivos afetados

- **Criar:** `src/components/agenda-lider/card/NovaMissaoDialog.tsx`
- **Editar:**
  - `src/components/agenda-lider/board/MissoesBoardView.tsx` (botão + dialog state, remover prompt)
  - `src/components/agenda-lider/board/MissaoCardCompact.tsx` (uppercase no título)
  - `src/components/agenda-lider/card/MissaoDetailDialog.tsx` (uppercase no título)
  - `src/components/agenda-lider/chat/MissoesPreviewCard.tsx` (uppercase no título)
  - Arquivos de `meu-painel/` que renderizam título de missão (uppercase)

Sem mudanças no banco, edge function ou hooks.

Posso aplicar?
