## Objetivo

Resolver duas melhorias na aba **Escalas** (Gestão de Pessoas):

1. Permitir cadastrar um funcionário direto do **Editor de Escalas** (`ManualScheduleGrid`), já vinculando-o ao **setor ativo** e a um **cargo** (com vínculo `sector_job_titles`).
2. Ajustar o input de **POP** (efetivos e extras) na configuração de matriz para que números de **2+ dígitos** apareçam por inteiro sem cortar.

---

## 1. Cadastro rápido de funcionário no Editor de Escalas

### Onde
- `src/components/escalas/ManualScheduleGrid.tsx` — adicionar botão **"Novo funcionário"** no cabeçalho da grade (próximo aos filtros de cargo/setor já existentes), visível quando há `activeSectorId` selecionado.
- Criar novo componente `src/components/escalas/QuickCreateEmployeeModal.tsx`, reaproveitando a lógica de `TeamManagement.tsx`.

### O que o modal faz
Campos no modal (todos no mesmo passo):
- **Unidade** — pré-preenchida com `selectedUnit` do editor (admin pode trocar).
- **Setor** — pré-preenchido com o setor ativo da grade (`activeSectorId`); somente leitura ou seleção entre setores da unidade.
- **Cargo** — `Select` com cargos já existentes da unidade (`useJobTitles`) **+ opção "Novo cargo"**, igual ao `TeamManagement`. Quando o cargo escolhido **ainda não está vinculado ao setor**, vincula automaticamente.
- **Nome** (obrigatório).
- **Gênero** (M/F).
- **Telefone** (opcional, máscara igual ao `TeamManagement`).

### Fluxo de salvamento (em ordem)
1. `useUpsertJobTitle` → garante o `job_title_id` na unidade.
2. `useAddSectorJobTitle` → vincula `(sector_id, job_title_id)` se ainda não vinculado (idempotente).
3. `useAddEmployee` → cria o funcionário com `unit_id`, `name`, `gender`, `phone`, `job_title`, `job_title_id`.
4. Invalida queries de `employees` e `sector_job_titles` → o novo funcionário aparece imediatamente em `sectorBaseEmployees` da grade ativa.
5. Toast de sucesso e modal fecha.

### Reuso de regras
- Mesma validação de duplicidade do `TeamManagement` (mensagem amigável `friendlyEmployeeError`).
- Respeita `useUserProfile` + `useAccessibleStores` para admins (ainda podem trocar a unidade).

---

## 2. Visualização do POP — input de dezenas legível

### Onde
- `src/components/escalas/StaffingMatrixConfig.tsx` (linhas ~374 e ~388 — inputs `efetivos` e `extras` da matriz).

### Mudança
- Atualmente os dois `Input` usam `w-12` (48px) com `text-xs`, o que corta o valor quando passa de 1 dígito (ex: `12`, `23`).
- Aumentar a largura para acomodar até 3 dígitos confortavelmente:
  - `w-12 text-xs` → `w-14 text-sm tabular-nums px-1`.
  - Manter `text-center` e o `key` baseado no valor (preserva o comportamento de re-render).
- Aplicar a mesma melhoria nos dois campos (efetivos e extras) para manter alinhamento visual.

Sem alterações em lógica de cálculo, apenas estilo.

---

## Verificação

1. Editor de Escalas → selecionar setor "Garçom" → clicar em **Novo funcionário** → criar "Teste Garçom" / cargo "Garçom" → confirmar que aparece imediatamente como funcionário da base do setor (sem reload).
2. Configurações → Matriz POP → digitar `12` em um efetivo → todo o número visível dentro do input em todos os dias da semana.
3. Mobile (922px e abaixo): inputs continuam dentro da célula sem quebrar layout.
