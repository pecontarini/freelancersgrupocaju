## Contexto

Implementar no frontend as Etapas 3 e 4 da spec "Secullum = fonte da verdade", garantindo que:
- A tela de **Escalas** só ofereça CLTs sincronizados do Secullum (`banco_id IS NOT NULL` + `secullum_id IS NOT NULL`).
- O cadastro de funcionário pelo Painel seja **freelancer por padrão**, com validações fortes, e CLT só por **urgência aprovada** com `aguardando_secullum=TRUE`.

Tudo seguindo o design system Cajupar Apple-minimal já vigente — sem emojis, com microinterações suaves, mensagens humanas, e mobile-first.

---

## 1. Hook `useEmployees` — variante "schedulable"

Em `src/hooks/useEmployees.ts`, adicionar:

- Expor os novos campos no tipo `Employee`: `banco_id: number | null`, `secullum_id: number | null`, `aguardando_secullum: boolean | null`.
- Novo hook **`useSchedulableEmployees(unitId, additionalUnitIds?)`** que reaproveita a query base mas aplica:
  ```
  .eq("active", true)
  .eq("worker_type", "clt")
  .not("banco_id", "is", null)
  .not("secullum_id", "is", null)
  .or("aguardando_secullum.is.null,aguardando_secullum.eq.false")
  ```
  Mantém a deduplicação por CPF existente.
- Manter `useEmployees` como está (usado por TeamManagement, FreelancerAddModal, etc).
- Tradutor de erro `friendlyEmployeeError`: adicionar mapeamentos para os códigos do trigger guardião (`P0001`) com mensagens humanas (ex: "Funcionário CLT precisa estar sincronizado com o Secullum", "CPF inválido", "Valor da diária obrigatório", "Cadastro CLT só pode ser criado via urgência").

## 2. Tela Escalas — filtro de CLTs sincronizados

Substituir `useEmployees(...)` por `useSchedulableEmployees(...)` **apenas** nas telas/seletores de escala:

- `src/components/escalas/ManualScheduleGrid.tsx` (linha 202)
- `src/components/escalas/WeeklyScheduler.tsx` (linha 132)
- `src/components/escalas/MobileScheduler.tsx` (linha 75)
- `src/components/escalas/OperationalDashboard.tsx` (linha 104)

**Não trocar** em: `FreelancerAddModal`, `TeamManagement`, `BulkImportTab`, `QuickCreateEmployeeModal`, `ScheduleExcelFlow` (pipelines de import/cadastro precisam da lista completa).

**Empty state** padronizado em cada grid quando `employees.length === 0`:

```
Nenhum funcionário CLT sincronizado nesta unidade.
Verifique se o cadastro no Secullum foi feito.
A sync acontece todo dia às 5h.
```

Renderizado dentro de um `cj-card` discreto, ícone `CloudOff` lucide, com um botão secundário **"Atualizar agora"** que faz `queryClient.invalidateQueries(["employees"])`.

## 3. Modal de cadastro — refactor de UX

Refatorar `src/components/escalas/QuickCreateEmployeeModal.tsx` para o novo fluxo guiado:

**Estrutura visual (mobile-first, sheet em <md):**

```text
┌─────────────────────────────────────────┐
│  Novo cadastro                          │
│  Por padrão criamos freelancers. CLT    │
│  vem do Secullum às 5h.                 │
├─────────────────────────────────────────┤
│  [ Freelancer ]  [ CLT (urgência) ]    │  ← Segmented (worker_type)
│                                         │
│  ── campos dinâmicos por tipo ──        │
└─────────────────────────────────────────┘
```

**Comportamento:**

- Segmented control no topo (Radix `ToggleGroup`/Tabs estilo `cj` segmented) com default **Freelancer**.
- Trocar de tipo dispara animação suave de fade entre os campos (framer-motion).
- Quando seleciona **CLT**, mostra alerta inline (variant `accent`/âmbar do design system, sem cor crua):
  > "Cadastro CLT deve ser feito pelo Secullum primeiro. Use esta opção apenas em casos de urgência aprovada."
  E o botão principal vira **"Solicitar cadastro urgente"** (estilo `cj-btn-secondary` + ícone `ShieldAlert`), que abre o modal de confirmação.
- Quando seleciona **Freelancer**, botão principal: **"Criar freelancer"**.

**Campos por tipo:**

| Campo        | Freelancer | CLT (urgência) | Validação cliente                              |
|--------------|------------|----------------|------------------------------------------------|
| Unidade      | sim        | sim            | obrigatório                                    |
| Setor        | sim        | sim            | obrigatório                                    |
| Cargo        | sim        | sim            | obrigatório                                    |
| Nome         | sim        | sim            | 2+ palavras, 2+ chars cada → "Nome completo obrigatório" |
| CPF          | sim        | **sim**        | 11 dígitos + algoritmo válido → "CPF inválido" |
| Telefone     | **sim**    | opcional       | DDD+número → "Telefone obrigatório"            |
| Valor diária | **sim**    | —              | > 0 → "Valor da diária obrigatório"            |
| Gênero       | sim        | sim            | M/F                                            |

- CPF e diária: usar formatação on-blur (`000.000.000-00`, `R$ 120,00`).
- Validação CPF: util `isValidCpf` (criar em `src/lib/cpf.ts` se não existir — verificar `useCpfLookup`).
- Auto-fill: ao digitar CPF de freelancer, chamar `useCpfLookup` para sugerir nome/telefone/valor já cadastrados em outras unidades.

**Modal de confirmação de urgência:**

Novo componente `UrgentCltConfirmDialog` (AlertDialog) com o texto exato da spec, dois botões: **Cancelar** / **Confirmar solicitação**.

Ao confirmar:
```ts
addEmployee.mutate({
  unit_id, name, gender, cpf, job_title, job_title_id,
  worker_type: "clt",
  aguardando_secullum: true,
  active: true,
});
```

Após sucesso: toast informativo + fechar modal:
> "Solicitação enviada. O DP precisa regularizar no Secullum em até 7 dias."

**Estados:**
- Loading: `Loader2` no botão, inputs desabilitados.
- Erro do trigger (P0001): exibido em `Alert` no topo do modal + toast curto.
- Sucesso freelancer: toast "Freelancer criado!" + fechar.

## 4. Hook `useAddEmployee` — aceitar novos campos

Em `useEmployees.ts`, ampliar o tipo de entrada:

```ts
useAddEmployee.mutationFn(params: {
  unit_id: string;
  name: string;
  gender: "M" | "F";
  phone?: string;
  job_title?: string;
  job_title_id?: string;
  cpf?: string;
  worker_type?: "clt" | "freelancer";
  default_rate?: number;
  aguardando_secullum?: boolean;
})
```

Default no insert: `worker_type ?? "freelancer"`. Limpar CPF para apenas dígitos antes de salvar.

## 5. Componentes UI auxiliares

- `src/components/escalas/WorkerTypeSegmented.tsx` — segmented control reutilizável (Freelancer | CLT urgência) usando tokens `cj`.
- `src/components/escalas/UrgentCltConfirmDialog.tsx` — AlertDialog com a copy da spec.
- `src/components/escalas/SchedulableEmptyState.tsx` — empty state padrão para grids.
- `src/lib/cpf.ts` — `isValidCpf(cpf: string): boolean` (algoritmo dos dígitos verificadores) + `formatCpf` / `unmaskCpf`.

## 6. QA manual (checklist da spec)

1. Criar freelancer completo (nome, CPF, telefone, diária) → cria com sucesso.
2. Criar freelancer sem diária → bloqueado no frontend com mensagem específica.
3. Abrir modal e escolher CLT → vê alerta + botão "Solicitar cadastro urgente".
4. Clicar urgência e confirmar → cria CLT com `aguardando_secullum=true`.
5. Ir à tela de Escala (Manual e Weekly) → só lista CLTs sincronizados; freelancers ausentes; CLT em urgência ausente.
6. Empty state aparece corretamente quando unidade não tem CLT sincronizado.
7. Mobile (<768px): modal vira sheet, segmented control com 44px de altura, campos legíveis.
8. Dark/light: tokens `cj` aplicados corretamente.

## Detalhes técnicos relevantes

- **Não tocar** em `supabase/types.ts`, `client.ts`, RLS, triggers — backend já está pronto.
- Mensagens do trigger guardião serão capturadas em `friendlyEmployeeError` por substring (ex.: contém `"banco_id"`, `"aguardando_secullum"`, `"default_rate"`, `"cpf"`).
- `useCpfLookup` já cobre busca por CPF — reaproveitar no autofill do freelancer.
- A spec menciona `unit_id` obrigatório: manter o `UnidadeSelector` quando admin/operator, ou usar `effectiveUnidadeId` do `useUnidade()` para gerentes (regra já vigente no projeto).
- Design system: usar `cj-card`, `cj-btn-primary`, `cj-btn-secondary`, segmented control global (`[role="tablist"]`), tokens `--cj-accent`, `--cj-warn`. Sem emojis (lucide-react: `UserPlus`, `Sparkles`, `ShieldAlert`, `CloudOff`, `Info`).
- Tudo Tailwind + componentes shadcn existentes (Dialog, AlertDialog, Tabs, Input, Label, Select). Nenhuma dependência nova.

## Arquivos afetados (resumo)

- **Editar:** `src/hooks/useEmployees.ts`, `src/components/escalas/QuickCreateEmployeeModal.tsx`, `src/components/escalas/ManualScheduleGrid.tsx`, `src/components/escalas/WeeklyScheduler.tsx`, `src/components/escalas/MobileScheduler.tsx`, `src/components/escalas/OperationalDashboard.tsx`.
- **Criar:** `src/components/escalas/WorkerTypeSegmented.tsx`, `src/components/escalas/UrgentCltConfirmDialog.tsx`, `src/components/escalas/SchedulableEmptyState.tsx`, `src/lib/cpf.ts`.

## Fora de escopo

- Mudanças no Secullum, sync 5h, trigger ou RLS.
- BulkImport e ScheduleExcelFlow (mantêm comportamento atual para preservar import legado).
- Tela "Presença Freelancers" (já é o canal único de freelancer).
