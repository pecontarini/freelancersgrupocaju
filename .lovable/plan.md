

# Plano: Mostrar freelancers aprovados via check-in na lista de Budgets Gerenciais

## Problema

O fluxo funciona tecnicamente: após assinar o lote com senha, a função `promote_approved_checkins` cria registros em `checkin_budget_entries`. Esses registros **já são somados nos totais** do card "Freelancers" (linha 355 do BudgetsGerenciaisTab). Porém, **não aparecem na lista de freelancers** abaixo dos cards — apenas lançamentos manuais (`freelancer_entries`) são exibidos ali. Isso faz parecer que nada aconteceu.

## Solução

Unificar a lista de freelancers para exibir **ambas** as fontes:
1. Lançamentos manuais (`freelancer_entries`) — como já funciona
2. Lançamentos via check-in (`checkin_budget_entries`) — com badge visual "Via Check-in"

### `src/components/dashboard/BudgetsGerenciaisTab.tsx`

- Criar uma lista unificada (`unifiedFreelancerList`) que combina `filteredFreelancers` + `checkinBudgetEntries` filtrados por data
- Cada item terá um campo `source: "manual" | "checkin"` para diferenciar visualmente
- Ordenar por data descendente
- Na renderização da lista, exibir um badge "Check-in" nos itens vindos do check-in
- Itens de check-in não terão botão "Editar" nem "Excluir" (são gerenciados pelo fluxo de aprovação)
- Atualizar o contador de registros para refletir o total unificado

### Estrutura do item unificado

```text
type UnifiedEntry = {
  id: string
  nome: string
  funcao: string  // "Freelancer" para checkin entries
  loja: string
  data: string    // YYYY-MM-DD
  valor: number
  source: "manual" | "checkin"
  original: FreelancerEntry | CheckinBudgetEntry
}
```

### Mudanças visuais

- Badge verde "Via Check-in" ao lado do nome para entradas do check-in
- Sem botões de edição/exclusão para entradas do check-in
- Texto do card atualizado: "X lançamento(s) manual(is) + Y via check-in"

| Arquivo | Mudança |
|---------|---------|
| `src/components/dashboard/BudgetsGerenciaisTab.tsx` | Unificar lista de freelancers com checkin_budget_entries |

