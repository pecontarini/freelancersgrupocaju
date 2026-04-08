

# Plano: Prevenir duplicatas na importação + Botão de remover funcionário da escala

## Duas mudanças complementares

### 1. Prevenir duplicatas na importação (`ScheduleExcelFlow.tsx`)

Antes de inserir as escalas no banco, verificar quais combinações `(employee_id, schedule_date, sector_id)` já existem com status ativo. Filtrar essas entradas e só inserir as que são realmente novas.

- Após montar o array `rows`, buscar schedules existentes no período para os mesmos employees/sectors
- Remover do array as linhas que já existem
- Exibir toast informativo se houve linhas ignoradas: "X lançamento(s) ignorado(s) por já existirem"
- Se nenhuma linha nova restar, mostrar aviso e não inserir nada

### 2. Botão de remover funcionário da semana (`ManualScheduleGrid.tsx` + `useManualSchedules.ts`)

Adicionar ícone de lixeira ao lado do nome de cada funcionário no grid. Ao clicar:

- Exibir `AlertDialog` de confirmação: "Remover todas as escalas de **[nome]** nesta semana?"
- Ao confirmar, cancelar todos os schedules daquele employee na semana ativa (todos os setores da unidade)
- Novo hook `useCancelEmployeeWeek` em `useManualSchedules.ts`:
  - Recebe `employee_id`, `sector_ids[]`, `week_start`, `week_end`
  - Atualiza status para `cancelled` nos schedules ativos do período
  - Invalida queries e exibe toast com quantidade removida

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/ScheduleExcelFlow.tsx` | Dedup antes do insert |
| `src/components/escalas/ManualScheduleGrid.tsx` | Ícone Trash2 + AlertDialog na linha do funcionário |
| `src/hooks/useManualSchedules.ts` | Novo hook `useCancelEmployeeWeek` |

## Resultado
- Importações repetidas não criam duplicatas
- Funcionários duplicados existentes podem ser removidos da semana com um clique

