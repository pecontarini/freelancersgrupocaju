

# Plano: Férias com intervalo de datas (lançamento automático em lote)

## Problema
Hoje, ao clicar em "MARCAR FÉRIAS", o sistema registra férias apenas para o dia selecionado. O usuário precisa repetir o processo dia a dia, o que é impraticável para períodos de 15-30 dias.

## Solução
Ao clicar em "MARCAR FÉRIAS", abrir um sub-formulário pedindo **data de início** e **data de fim**. Ao confirmar, o sistema gera automaticamente um registro de `schedule_type: "vacation"` para cada dia do intervalo, ignorando dias que já tenham escala ativa.

## Mudanças

### 1. `ScheduleEditModal.tsx` — Sub-formulário de férias

- Ao clicar no botão "MARCAR FÉRIAS", em vez de chamar `handleSetAbsence("vacation")` diretamente, exibir dois campos de data (início e fim) dentro da aba Ausências
- Pré-preencher a data de início com o dia atualmente selecionado
- Mostrar um resumo: "X dias de férias serão lançados"
- Botão "Confirmar Férias" dispara o lançamento em lote

### 2. `useManualSchedules.ts` — Novo hook `useBulkVacation`

- Recebe: `employee_id`, `sector_id`, `start_date`, `end_date`, `shift_type`
- Gera array de datas do intervalo (usando loop simples de Date)
- Busca escalas existentes do funcionário no período para evitar duplicatas
- Cancela escalas `working` existentes no período (substituir por férias)
- Insere em lote registros com `schedule_type: "vacation"`, `start_time: null`, `end_time: null`
- Invalida queries de `manual-schedules` e `schedules`

### 3. Fluxo do usuário

1. Clica na célula de um funcionário na grade
2. Modal abre → aba "Ausências"
3. Clica "MARCAR FÉRIAS"
4. Aparecem campos de data início/fim + contagem de dias
5. Confirma → sistema lança férias em todos os dias do intervalo
6. Toast de sucesso: "Férias lançadas: X dias"

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/ScheduleEditModal.tsx` | Adicionar sub-formulário de datas para férias |
| `src/hooks/useManualSchedules.ts` | Adicionar hook `useBulkVacation` |

## Detalhes técnicos

- Gerar datas com loop simples incrementando dia a dia (string `YYYY-MM-DD` para evitar problemas de timezone)
- Antes de inserir, buscar `schedules` existentes do employee no intervalo e cancelar as que forem `working`
- Inserir em batch único via `supabase.from("schedules").insert([...])`
- Limite de segurança: máximo 45 dias para evitar erros acidentais

