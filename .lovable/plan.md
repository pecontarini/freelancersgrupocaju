

# Plano: Mostrar todas as auditorias sem limite de período

## Diagnóstico

O filtro de período máximo atual é "Últimos 90 dias". Com 98 auditorias desde dez/2025, ao selecionar "Todas as lojas" o usuário só vê as que caem dentro do período selecionado (padrão 30 dias). Não há opção "Todo o período".

O código não trunca dados — o limite é exclusivamente do filtro de datas.

## Mudanças

### `src/components/dashboard/AuditDiagnosticDashboard.tsx`

1. Adicionar opção `"all"` ao `PERIOD_OPTIONS`:
   ```typescript
   { value: "all", label: "Todo o Período" }
   ```

2. Atualizar `getDateRange` para tratar `"all"` — retornar um range desde 2020-01-01 até hoje (ou seja, sem filtro efetivo).

3. No hook `useSupervisionAudits`, quando `dateRange` cobre "all", o `fetchAllRows` já funciona corretamente — não precisa de mudança no hook.

## Arquivos editados
| Arquivo | Mudança |
|---------|---------|
| `src/components/dashboard/AuditDiagnosticDashboard.tsx` | Adicionar "Todo o Período" às opções e ao switch de `getDateRange` |

