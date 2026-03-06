

# Plano: Garantir funcionamento definitivo de criacao e edicao de Budgets

## Diagnostico

Revisei todo o codigo atual e o banco de dados. A estrutura esta correta: a tabela `store_budgets` tem a coluna `apoio_venda_budget`, o indice unico `(store_id, month_year)` existe, e as politicas RLS permitem INSERT/UPDATE para admin e operator. Os componentes `InlineBudgetEditor` e `OperationalBudgetConfigSection` ja possuem o botao de edicao (lapiz) e try/catch.

Porem, identifiquei problemas sutis que podem causar falhas silenciosas:

### Problema 1: Re-autenticacao quebrando a sessao
O `InlineBudgetEditor` usa `signInWithPassword` para validar a senha. Isso pode causar um **refresh de token** que invalida queries em cache e causa comportamento inesperado no submit subsequente. A solucao e garantir que apos a re-autenticacao, as queries sejam re-validadas.

### Problema 2: Upsert com `total_budget` como GENERATED column
O upsert envia apenas as colunas de input (sem `total_budget`), o que esta correto. Mas se houver qualquer campo extra no payload, o Postgres rejeitara silenciosamente. Preciso garantir que o payload esta limpo.

### Problema 3: BudgetDrillDownDialog nao suporta "apoio_venda"
O tipo `BudgetCategory` nao inclui `apoio_venda`, entao clicar nessa categoria no dashboard nao abre drill-down.

### Problema 4: Feedback visual insuficiente
Apos salvar com sucesso, o dialog fecha mas nao ha confirmacao visual clara (o toast pode ser ignorado). Alem disso, o formulario de edicao na `OperationalBudgetConfigSection` nao trava os campos de Loja/Mes durante edicao.

## Mudancas planejadas

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useStoreBudgets.ts` | Apos upsert bem-sucedido, invalidar queries imediatamente e aguardar refetch. Adicionar log detalhado de erro. |
| `src/components/InlineBudgetEditor.tsx` | Apos re-autenticacao por senha, forcar `queryClient.invalidateQueries` para renovar dados em cache. Adicionar feedback visual mais claro no submit. |
| `src/components/OperationalBudgetConfigSection.tsx` | Travar Loja/Mes durante edicao (`disabled={!!editingBudgetId}`). Mudar titulo do dialog para "Editar Orcamento" quando em modo edicao. Resetar `editingBudgetId` ao fechar dialog. |
| `src/components/dashboard/BudgetDrillDownDialog.tsx` | Adicionar "apoio_venda" ao tipo `BudgetCategory` e ao `CATEGORY_CONFIG`. |
| `src/components/dashboard/BudgetsGerenciaisTab.tsx` | Garantir que o card de "Apoio a Venda" existe e que o drill-down funciona para essa categoria. |

## Resumo
- 5 arquivos editados
- Zero mudancas no banco (estrutura ja esta correta)
- Foco em robustez do salvamento, feedback ao usuario e suporte completo a "Apoio a Venda"

