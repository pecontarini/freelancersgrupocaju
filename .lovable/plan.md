

## Plano: 4 melhorias de usabilidade

### 1) Utensílios — ocultar item da contagem
**Onde:** `ContagemSemanal.tsx` (lista/tabela e cards mobile).

**O que farei:**
- Adicionar um botão simples (ícone `EyeOff`) em cada linha da contagem que marca o item como oculto **para a loja atual**.
- Implementar como soft-hide setando `is_active = false` em `utensilios_items` (mesma flag já filtrada por `useUtensiliosItems`). Assim o item some imediatamente da contagem da loja, sem afetar outras unidades nem o catálogo global.
- Acima da lista, um pequeno toggle "Mostrar ocultos (N)" que, quando ligado, lista os ocultos com botão `Eye` para reativar.
- Novo hook `useToggleUtensilioVisibility` em `useUtensilios.ts` (update + invalidate `utensilios_items`).

**Por que assim:** reaproveita coluna existente, é reversível, e por ser por loja respeita a operação de cada unidade.

---

### 2) Escalas — copiar escala de um colaborador para outro
**Onde:** `ManualScheduleGrid.tsx` (linha do colaborador) + `useManualSchedules.ts`.

**O que farei:**
- Adicionar um botão `Copy` ao lado do `Trash2` na célula sticky do nome (linha do funcionário). Ao clicar, entra em **modo "copiar"**: a linha fica destacada e aparece uma faixa no topo do grid: *"Copiando escala de FULANO. Selecione um colaborador destino"* + botão Cancelar.
- Ao clicar em outra linha de funcionário (ou em um item de uma lista de seleção compacta), abrimos um diálogo de confirmação curto:
  - Lista os turnos que serão copiados (dia/turno/setor/horário).
  - Opção "Sobrescrever escalas existentes do destino" (default: pular dias já preenchidos).
- Novo hook `useCopyEmployeeWeek({ sourceEmployeeId, targetEmployeeId, weekStart, weekEnd, sectorIds, overwrite })`:
  - Lê `schedules` do origem na semana.
  - Para cada um, faz `upsert` em `schedules` trocando `employee_id` para o destino, mantendo `schedule_date`, `shift_id`, `sector_id`, `start_time`, `end_time`, `praca_id`, `daily_rate`.
  - Respeita as constraints de unicidade já existentes (skip se overwrite=false e já houver schedule no dia).
- Após copiar, o usuário pode clicar em qualquer célula do destino para refinar (já existe — abre `ScheduleEditModal`).

**Por que assim:** sem nova UI pesada, fluxo clique→clique→confirma; aproveita o `ScheduleEditModal` para edição posterior.

---

### 3) Remover "Estoque Geral" apenas visualmente
**Onde:** apenas navegação — `BottomNavigation.tsx` e `AppSidebar.tsx`.

**O que farei:**
- Remover o item `{ id: "estoque", label: "Estoque", icon: Warehouse }` do array `navItems` em `BottomNavigation.tsx`.
- Remover o item `ESTOQUE GERAL` do `menuItems` em `AppSidebar.tsx`.
- **Não** mexer em `Index.tsx` (rota/case `estoque` continua existindo) nem em `EstoqueTab.tsx` — assim a aba some do menu mas o módulo permanece intacto, podendo ser religada depois trocando uma linha.

---

### 4) Agenda na versão mobile
**Onde:** `BottomNavigation.tsx` + `Index.tsx` (já delega `agenda` para `navigate("/agenda")`).

**O que farei:**
- Adicionar `Agenda` ao painel/menu mobile. Como o bottom bar já tem 5 itens + Perfil (cheio), vou colocar a Agenda em **dois lugares** para garantir alcance:
  1. Botão dedicado dentro do `Sheet` lateral do header e do `Sheet` inferior do "Perfil" (ao lado de Utensílios). Visível para todos os perfis (não só admin).
  2. Substituir `Estoque` (que será removido no item 3) por `Agenda` no bottom bar — assim ela ganha o slot fixo que o Estoque deixou. Ícone `Calendar`, label "Agenda".
- O clique chama `onTabChange("agenda")`, que `Index.tsx` já intercepta e roteia para `/agenda`.
- A página `/agenda` em si já existe; vou apenas verificar que ela renderiza bem em 440px (sem mexer na lógica). Se houver overflow no header de filtros, aplico `flex-wrap` mínimo — sem reescrever o módulo.

---

### Arquivos
- **Editar**: `src/hooks/useUtensilios.ts` (novo hook `useToggleUtensilioVisibility`).
- **Editar**: `src/components/utensilios/ContagemSemanal.tsx` (botão ocultar/reexibir + filtro "mostrar ocultos").
- **Editar**: `src/hooks/useManualSchedules.ts` (novo `useCopyEmployeeWeek`).
- **Editar**: `src/components/escalas/ManualScheduleGrid.tsx` (botão Copy, modo copiar, banner, diálogo).
- **Editar**: `src/components/layout/BottomNavigation.tsx` (remover Estoque, adicionar Agenda no bottom bar e nos Sheets).
- **Editar**: `src/components/layout/AppSidebar.tsx` (remover Estoque do menu desktop).
- **Eventual ajuste mínimo**: `src/pages/Agenda.tsx` se houver quebra visual em 440px (apenas wrap/spacing, nada funcional).

### Validação que farei
- Ocultar um utensílio na loja A e confirmar que continua aparecendo na loja B.
- Copiar escala de um funcionário CLT para outro na mesma semana (com e sem overwrite).
- Conferir que "Estoque Geral" sumiu do menu mobile e desktop, mas a rota interna ainda funciona.
- Abrir Agenda pelo bottom bar e pelo Sheet de Perfil em 440px.

