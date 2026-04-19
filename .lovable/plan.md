

## Plano: 3 melhorias na aba de Escalas

### 1) Editar cargo de funcionário direto da escala

**Hoje:** Para mudar cargo só na aba "Equipe" (Team Management). O gestor que está montando escala precisa sair da tela.

**O que vou fazer:**
- Adicionar um pequeno botão `Pencil` ao lado do nome do colaborador na coluna sticky do grid (do lado do `→ próxima` já existente).
- Clicar abre um **mini-modal "Editar funcionário"** com: nome, cargo (select com `job_titles` da loja + opção "Outro"), telefone, gênero. Mesmos campos do `TeamManagement`, mas enxuto.
- Salvar usa `useUpdateEmployee` + `useUpsertJobTitle` (já existentes) → invalida `["employees"]` → grid atualiza imediatamente, inclusive a re-agrupação por função.
- Sem nova tabela. Sem nova migration.

**Arquivo:** `src/components/escalas/ManualScheduleGrid.tsx` + novo componente leve `src/components/escalas/EditEmployeeQuickModal.tsx` (reutilizando os hooks existentes).

---

### 2) Justificativa para "Banco de Horas" como tipo de ausência

**Hoje:** O `ScheduleEditModal` aba "Ausências" tem 3 botões: FOLGA, FÉRIAS, ATESTADO. Não tem opção para "Banco de Horas" (compensação).

**O que vou fazer:**
- **Migration 1**: estender o enum `schedule_type` adicionando o valor `'banco_horas'`.
- Adicionar 4º botão "BANCO DE HORAS" na aba Ausências (cor azul, ícone `Clock4`), com mesmo padrão dos outros (clicar → salva direto via `useUpsertSchedule`).
- No grid, células com `schedule_type='banco_horas'` mostram badge cinza-azul "BH" (igual ao padrão atual de "FOLGA"/"FÉRIAS").
- Atualizar o tipo TS `schedule_type` em `useManualSchedules.ts` + `ScheduleEditModal.tsx` para incluir o novo valor.
- **`useImportEscalas` keyword mapping** (se existir): adicionar "BANCO HORAS" → `banco_horas` no parser.

**Arquivos:**
- Migration `ALTER TYPE schedule_type ADD VALUE 'banco_horas';`
- `src/hooks/useManualSchedules.ts` — tipo
- `src/components/escalas/ScheduleEditModal.tsx` — novo botão + handler
- `src/components/escalas/ManualScheduleGrid.tsx` — badge na célula

---

### 3) "Domingo do mês" + badge de aviso ao escalar domingo

**Hoje:** O sistema já valida domingos para CLT feminino (Art. 386 CLT) no `validate_schedule_clt`, mas não tem **marca explícita** que diga "este foi o domingo de folga do mês" e não exibe esse status no grid.

**Estratégia:** Reutilizo `schedule_type='off'` + detecção por `EXTRACT(DOW)=0` na data. Não preciso criar campo novo — qualquer FOLGA num domingo conta como "domingo do mês". Isso mantém simples e usa dados que já existem.

**O que vou fazer:**

**a) Marcação visual ao salvar FOLGA num domingo**
- Quando usuário marca FOLGA via `ScheduleEditModal` numa data que é domingo → o registro `off` no domingo já fica como "domingo do mês" automaticamente (sem campo extra).
- Toast de confirmação extra: *"Domingo de folga registrado para FULANO em ABRIL."*

**b) Novo hook `useEmployeeSundaysOff(employeeId, monthRef)`**
- Conta no `schedules` quantos domingos com `schedule_type='off'` (ou `vacation`) o funcionário tem no mês de referência (mês da semana atualmente exibida).
- Cacheado por `(employeeId, YYYY-MM)`.
- Usado para exibir badge.

**c) Badge "🌞 DOM ✓" no grid**
- Na coluna sticky do nome, quando o funcionário **já tem ≥1 domingo de folga no mês corrente**, mostra um badge verde compacto "DOM ✓" (ícone `Sun` da lucide).
- Quando **não tem nenhum domingo de folga no mês**, mostra badge laranja "DOM ✗" (alerta visual).
- Apenas para colaboradores CLT (freelancers ignorados).

**d) Aviso ao escalar trabalho num domingo**
- No `ScheduleEditModal`, quando o usuário abre a célula de um **domingo** e o tipo selecionado é "Turno" (working):
  - Lê o status de domingos do mês via novo hook.
  - Se a pessoa **já não teve nenhum domingo de folga neste mês**, mostra alerta amarelo:  
    *"⚠️ FULANO ainda não teve domingo de folga em ABRIL."*
  - Se já teve → texto verde discreto: *"✓ FULANO já teve folga dominical este mês (DD/MM)."*
- Não bloqueia o salvar — só informa, mantendo padrão de "soft warnings" (mem `scheduler-clt-compliance`).

**Arquivos:**
- Novo hook `src/hooks/useSundayOff.ts` — `useEmployeeSundaysOff`
- `src/components/escalas/ManualScheduleGrid.tsx` — badge na coluna nome
- `src/components/escalas/ScheduleEditModal.tsx` — alerta no domingo + toast melhorado

---

### Validação que farei
- Editar cargo de "Auxiliar" → "Parrilheiro" na linha → grid re-agrupa imediatamente sob nova função.
- Marcar BH para um colaborador → célula mostra badge "BH" cinza-azul, salvo no banco como `schedule_type='banco_horas'`.
- Marcar FOLGA num domingo → próxima vez que clicar nesse colaborador, badge "DOM ✓" aparece no nome.
- Tentar escalar trabalho num domingo de quem ainda não folgou → alerta amarelo no modal.
- Mesmo colaborador entre semanas: a contagem de domingos é por mês corrente da visualização.

### Resumo técnico
- **1 migration**: `ALTER TYPE schedule_type ADD VALUE 'banco_horas';`
- **3 arquivos editados**: `ManualScheduleGrid.tsx`, `ScheduleEditModal.tsx`, `useManualSchedules.ts`
- **2 arquivos novos**: `EditEmployeeQuickModal.tsx`, `useSundayOff.ts`
- **Sem novas RLS** — reusa policies existentes em `schedules`/`employees`.

