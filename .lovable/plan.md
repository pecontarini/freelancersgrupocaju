# Plano — Edição de escalas mais ágil

Dois ajustes no editor de escalas (`ManualScheduleGrid` + `ScheduleEditModal`).

## 1) Horários encadeados no modal de turno

Quando o usuário abrir uma célula já preenchida e mexer em **Início** ou **Fim**, o outro campo desliza junto, preservando a **duração total** do turno original.

Comportamento:
- Ao abrir o modal, calcula-se `duracaoOriginal = fim − início` (do schedule existente, ou do default 08:00→16:20).
- Mexeu em **Início** → **Fim** = novo início + duracaoOriginal.
- Mexeu em **Fim** → **Início** = novo fim − duracaoOriginal.
- Intervalo (almoço) **não** muda automaticamente.
- Um cadeado/toggle pequeno "🔗 Manter duração" (ligado por padrão) permite desativar o encadeamento caso o líder queira mudar só uma ponta.
- Funciona com virada de meia-noite (lógica de minutos já existe em `calculateHours`).

Arquivo: `src/components/escalas/ScheduleEditModal.tsx`.

## 2) Novo padrão de clique nas células da grade

Hoje: 1 clique = seleciona célula (ativa), 2 cliques = abre modal.

Novo:
- **1 clique** numa célula **vazia** → marca **FOLGA** direto (sem abrir modal).
- **1 clique** numa célula que **já é FOLGA** → remove a folga (volta a vazia).
- **1 clique** numa célula com **turno trabalhado** → mantém comportamento de seleção apenas (não sobrescreve, para não destruir turno por engano).
- **2 cliques** em qualquer célula → abre o **modal de edição** (atual `handleCellClick`).
- Shift+clique e seleção retangular continuam iguais.

Implementação:
- Em `ManualScheduleGrid.tsx` (linhas ~1727–1750) ajustar `onClick` da `TableCell` da linha de funcionário ativo:
  - Se `copyMode` ou `e.shiftKey` → fluxo atual.
  - Caso contrário, checar `schedule`:
    - `!schedule` → chama `useUpsertSchedule` com `schedule_type: "off"` (mesma chamada usada hoje pelo botão "Marcar Folga" do modal).
    - `schedule.schedule_type === "off"` → `useCancelSchedule(schedule.id)`.
    - `schedule.schedule_type === "working"` → apenas `grid.setActive` (comportamento atual).
- `onDoubleClick` continua chamando `handleCellClick` → abre modal.
- Adicionar tooltip discreto "1 clique: folga · 2 cliques: editar" no hover da célula vazia.

Edge cases tratados:
- Linha do "Quadro base do setor" (linha 1986) também ganha o mesmo padrão de 1‑clique → folga.
- Slots de freelancer/IA não são afetados (mantêm fluxos próprios).
- Para não disparar folga acidental durante drag de seleção, checa-se que não houve `mousedown→mousemove` antes do click (se o `grid` já expõe isso, reutiliza; caso contrário, comparar coordenadas no `mousedown`/`click`).

## Verificação

- Abrir modal, mexer no Início → Fim acompanha; mexer no Fim → Início acompanha; desligar cadeado → campos independentes.
- Clicar em célula vazia → vira "FOLGA" sem modal.
- Clicar de novo na FOLGA → volta a vazia.
- Clicar em célula com turno → só fica selecionada (azul), não muda nada.
- Duplo-clique em qualquer célula → modal abre normalmente.
- Seleção retangular com Shift continua funcionando.

## Pontos para confirmar

- OK manter "1 clique em turno trabalhado = só seleciona" (mais seguro)? Ou prefere que sobrescreva por folga também?
- Cadeado de "manter duração" deve vir **ligado** por padrão, certo?
