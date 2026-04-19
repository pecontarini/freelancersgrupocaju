

## Plano: 3 melhorias definitivas no Editor de Escalas

### Problema 1 — Lançamento de Extra com CPF como campo principal

**Hoje:** O `FreelancerAddModal` abre em modo "Existente" (lista). O CPF só aparece em "Criar Novo" e o lookup só preenche o nome — não traz cargo, PIX, diária, etc.

**O que vou fazer:**
- Inverter o padrão: modal abre direto com **CPF como primeiro campo** (mesmo padrão da `FreelancerForm` em Budgets Gerenciais).
- Ao digitar 11 dígitos, dispara `lookupUnifiedByCpf` que já busca em 3 fontes (`freelancer_profiles`, `employees`, `freelancer_entries`).
- Pré-preenche automaticamente: **Nome, Cargo (se existe no setor), Chave PIX, Tipo PIX, Telefone**. Campos preenchidos ganham destaque verde (igual ao Budget).
- Se o CPF já existe como `employees` da loja → modo "vincular existente" silencioso (reusa o ID, sem precisar trocar de aba).
- Se não encontrar nada → mostra os campos para criar do zero (com CPF já preenchido).
- Mantém o toggle "Existente / Criar" como secundário, mas o fluxo padrão fica orientado por CPF.

**Arquivo:** `src/components/escalas/FreelancerAddModal.tsx` (refatoração de UX, sem novos hooks — `useCpfLookup` já está pronto).

---

### Problema 2 — Copiar escala para semana seguinte (deixar 100% fluído)

**Hoje:** Os hooks `useCopyEmployeeToNextWeek` e `useCopyWeekToNextWeek` já existem e funcionam. Os botões `CopyPlus` (linha do colaborador) e "Replicar → próxima" (header) também. **O problema é discoverability + feedback pós-cópia**, não a lógica.

**O que vou fazer:**
- **Tornar o botão de copiar mais visível na linha do colaborador**: trocar o ícone `CopyPlus` discreto por botão pequeno com label "→ próxima" (texto + ícone), ainda compacto, mas óbvio.
- **No diálogo de confirmação**, adicionar pré-cálculo: *"FULANO tem N escalas nesta semana. Y já existem na próxima → sobrescrever?"*. Mostrar lista resumida (dia → horário → setor) antes de confirmar.
- **Pós-confirmação**, em vez de só toast, oferecer botão **"Ver próxima semana"** que avança automaticamente a navegação para `currentWeekBase + 7`. Hoje o usuário tem que clicar no `>` manualmente para conferir.
- **Botão "Replicar semana inteira"**: mover do header para uma posição mais visível (ao lado do navegador de semana, com cor primária leve). Adicionar o mesmo pré-cálculo de conflitos.
- Garantir que ao copiar, **todos os dados originais são preservados**: `start_time`, `end_time`, `break_duration`, `sector_id`, `praca_id`, `agreed_rate`, `schedule_type`. (Já está correto no hook — vou validar com query de teste.)
- Adicionar tratamento explícito de **freelancers**: se o destino já tem freelancer marcado para outro dia, criar `freelancer_checkins` pendente automaticamente (já acontece via `useUpsertSchedule`, mas não no batch — vou replicar a lógica de `autoCreatePendingCheckin` no copy).

**Arquivos:**
- `src/components/escalas/ManualScheduleGrid.tsx` — UI dos botões + diálogos com pré-cálculo + auto-navegação.
- `src/hooks/useManualSchedules.ts` — adicionar `autoCreatePendingCheckin` no loop dos 2 hooks de copy (para freelancers).

---

### Problema 3 — Filtrar/agrupar escala por função (não alfabético)

**Hoje:** Linhas ordenadas por: CLT primeiro → freelancer, e dentro de cada grupo por nome alfabético (`a.name.localeCompare(b.name)`).

**O que vou fazer:**
- Adicionar um pequeno **seletor "Ordenar por"** acima do grid, com 2 opções:
  - **"Por função"** (default novo) — agrupa visualmente por `job_title`, com sub-cabeçalho cinza separando cada grupo (ex: *PARRILHEIRO (3)*, *AUXILIAR (5)*, *FREELANCER (2)*). Dentro de cada grupo, ordena por nome.
  - **"Alfabético"** — comportamento atual.
- Adicionar um filtro multi-select **"Função"** opcional (chips), que esconde linhas de quem não bate. Se vazio, mostra todas.
- Manter a divisão CLT vs Freelancer como sub-camada (CLTs aparecem primeiro dentro de cada função, freelancers no final do bloco).
- Aplicar a mesma ordenação ao "Quadro base do setor" (linhas colapsadas).

**Arquivo:** `src/components/escalas/ManualScheduleGrid.tsx` — adicionar estado `sortMode` + `filterJobTitleIds`, novo `useMemo` para `groupedRows` que retorna estrutura `{ jobTitle, employees[] }[]`, e renderizar sub-headers entre os grupos.

---

### Validação que farei
- Abrir lançamento de extra → digitar CPF de freelancer já cadastrado → confirmar que nome/cargo/PIX preenchem sozinhos.
- Copiar semana inteira → conferir que próximas 7 datas têm exatamente os mesmos horários, setores, praças e diárias, e que freelancers ganham checkin pendente.
- Trocar ordenação para "Por função" → conferir que grupos aparecem com contagem correta e funções vazias somem.
- Aplicar filtro de função → só funcionários daquela função aparecem.

### Arquivos resumidos
- **Editar**: `src/components/escalas/FreelancerAddModal.tsx`
- **Editar**: `src/components/escalas/ManualScheduleGrid.tsx`
- **Editar**: `src/hooks/useManualSchedules.ts`

Sem mudanças de banco/migrations.

