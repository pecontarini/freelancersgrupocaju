

# Plano: Feature 1 (Resumo de Horas) + Feature 2 (Dashboard POP)

## Diagnóstico

| Item | Valor confirmado |
|------|-----------------|
| Tabela de turnos | `schedules` |
| Campos de horário | `start_time`, `end_time` (time), `break_duration` (int, minutos) |
| Tabela POP | `staffing_matrix` (campos: `sector_id`, `day_of_week`, `shift_type`, `required_count`, `extras_count`) |
| Tabela de setores | `sectors` (campo `unit_id` vincula à loja) |
| Roles | `admin`, `operator` (sócio), `gerente_unidade`, `chefe_setor`, `employee` — via `useUserProfile` |
| Editor de escalas | `ManualScheduleGrid.tsx` — já carrega `schedules`, `employees`, `sectors`, `staffingMatrix` |
| Tabs de Escalas | `EscalasTab.tsx` — 6 sub-abas existentes |

---

## FEATURE 1 — Somatório de Horas Semanais

### Arquivo novo: `src/components/escalas/WeeklyHoursSummary.tsx`

Componente colapsável que recebe `schedules`, `employees` e `weekDays` como props do `ManualScheduleGrid`.

**Lógica de cálculo:**
- Para cada schedule `working`, calcula duração = `end_time - start_time` (se cruza meia-noite, soma 24h)
- Subtrai `break_duration` em minutos
- Agrupa por `employee_id` e dia
- Soma por semana

**Tabela renderizada:**
- Colunas: Funcionário | Seg | Ter | Qua | Qui | Sex | Sáb | Dom | Total
- Célula do dia: "6h" ou "8h30" ou "—"
- Célula vermelha se > 10h no dia
- Total verde (≤44h), amarelo (44-48h), vermelho (>48h)

**UI:** Usa `Collapsible` do shadcn, posicionado abaixo da grade semanal.

### Arquivo modificado: `src/components/escalas/ManualScheduleGrid.tsx`

- Importa e renderiza `<WeeklyHoursSummary>` após a tabela de escalas, passando `schedules`, `employees` e `weekDays`
- Atualiza automaticamente pois usa os mesmos dados reativos do React Query

---

## FEATURE 2 — Dashboard POP

### Arquivo novo: `src/hooks/usePopCompliance.ts`

Hook que:
1. Busca todas as `config_lojas`
2. Para cada loja, busca `sectors` → `staffing_matrix` + `schedules` da semana
3. Calcula conformidade por loja/setor/dia comparando escalados vs meta POP
4. Retorna dados estruturados para o dashboard

### Arquivo novo: `src/components/escalas/PopComplianceDashboard.tsx`

Dashboard com 4 blocos conforme especificado:

**Bloco 1 — 4 Cards:** Total setores, conformes (verde), com gaps (amarelo), críticos (vermelho)

**Bloco 2 — Mapa de conformidade:** Tabela lojas × dias com badges coloridos. Clique expande detalhamento por setor com setores, escalados, meta, diferença.

**Bloco 3 — Ranking de gaps:** Bar chart (Recharts, já usado no projeto) dos 10 setores com mais dias abaixo do POP.

**Bloco 4 — Heatmap semanal:** Grade 7 colunas × N lojas com quadrados coloridos.

**Filtros no topo:** Navegação de semana, multi-select de lojas, seletor de turno (Almoço/Jantar/Ambos).

**Acesso restrito:** Visível apenas para `isAdmin || isOperator`.

### Arquivo modificado: `src/components/escalas/EscalasTab.tsx`

- Adiciona nova tab `"pop-dashboard"` com ícone `BarChart3`
- Renderiza `<PopComplianceDashboard>` condicionalmente quando `isAdmin || isOperator`
- Usa `useUserProfile` para controle de visibilidade

---

## Resumo de arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/WeeklyHoursSummary.tsx` | Criar |
| `src/components/escalas/ManualScheduleGrid.tsx` | Modificar (adicionar painel de horas) |
| `src/hooks/usePopCompliance.ts` | Criar |
| `src/components/escalas/PopComplianceDashboard.tsx` | Criar |
| `src/components/escalas/EscalasTab.tsx` | Modificar (adicionar tab Dashboard POP) |

Nenhuma alteração no banco de dados é necessária. Todos os cálculos são feitos no frontend a partir de dados existentes.

