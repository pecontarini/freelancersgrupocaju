

# Plano: Adicionar "Apoio à Venda" ao Card de Saúde Financeira e Formulário Unificado

## Diagnóstico

A categoria "Apoio à Venda" já existe no banco de dados (`store_budgets.apoio_venda_budget`), no hook `useOperationalExpenses` (category `apoio_venda`), no `BudgetDrillDownDialog`, e no `OperationalExpenseForm`. Porém, está ausente em dois lugares críticos:

1. **FinancialHealthCard** -- não calcula, não exibe barra de progresso, nem saldo para "Apoio à Venda"
2. **UnifiedExpenseForm** -- tem apenas `"apoio"` (Apoio/Outros), falta `"apoio_venda"` como opção separada

## Mudanças

### 1. `src/components/FinancialHealthCard.tsx`

- Importar ícone `ShoppingBag` de lucide-react
- No `useMemo` de `stats`:
  - Extrair `apoioVenda` do `operationalTotals` (já retornado pelo hook como `.apoio` -- **nota**: o hook `getTotalsForStoreMonth` não calcula `apoio_venda` separadamente, apenas `apoio`. Precisa ajustar o hook primeiro)
  - Pegar `apoioVendaBudget` do budget (`budget?.apoio_venda_budget || 0`)
  - Criar `apoioVendaStats` via `mkStats`
  - Somar `apoioVenda` no `totalSpent`
  - Somar `apoioVendaBudget` no `totalBudget`
- Adicionar `CategoryProgressBar` para "Apoio à Venda" (ícone ShoppingBag, cor green-500, drill-down `"apoio_venda"`)
- Adicionar card de saldo "Saldo Apoio à Venda" no grid (bg-green-50)
- Atualizar a lógica do `budgetAmount` no `BudgetDrillDownDialog` para incluir o caso `apoio_venda`

### 2. `src/hooks/useOperationalExpenses.ts`

- No `getTotalsForStoreMonth`, adicionar cálculo de `apoio_venda`:
  ```typescript
  const apoio_venda = filtered
    .filter((e) => e.category === "apoio_venda")
    .reduce((sum, e) => sum + e.valor, 0);
  ```
- Retornar `apoio_venda` no objeto e somá-lo ao `total`

### 3. `src/components/UnifiedExpenseForm.tsx`

- Adicionar `"apoio_venda"` ao `CategoryType`
- Adicionar entrada `{ value: "apoio_venda", label: "Apoio à Venda", icon: ShoppingBag, color: "text-green-500" }` ao array `CATEGORIES`

## Arquivos editados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useOperationalExpenses.ts` | Calcular `apoio_venda` separadamente no `getTotalsForStoreMonth` |
| `src/components/FinancialHealthCard.tsx` | Adicionar barra de progresso, saldo e drill-down para "Apoio à Venda" |
| `src/components/UnifiedExpenseForm.tsx` | Adicionar categoria "Apoio à Venda" ao formulário |

