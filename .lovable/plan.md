

# Plano: Correções de Budgets Gerenciais e Filtros

## Problema 1: Budgets nao salvando + Botao de edicao

### Diagnostico
Investigando o banco, os dados de `store_budgets` existem e a estrutura esta correta (coluna `total_budget` e gerada automaticamente). As politicas RLS permitem INSERT/UPDATE para admin e operator. O problema provavel e um **erro silencioso** -- o `handleSubmit` no `InlineBudgetEditor` e no `OperationalBudgetConfigSection` usa `mutateAsync` sem `try/catch`, entao se o upsert falhar (ex: timeout, conflito de sessao apos re-autenticacao), o toast de erro aparece mas pode ser ignorado pelo usuario.

Alem disso, o fluxo de **re-autenticacao por senha** (`signInWithPassword`) pode causar um refresh de sessao que invalida o token no meio da operacao.

### Solucao
1. **Adicionar `try/catch`** nos handlers de submit para garantir feedback claro ao usuario
2. **Adicionar botao de edicao (lapiz)** na tabela de budgets ativos -- ao clicar, preenche o formulario com os valores existentes para edicao
3. **Restringir acesso**: Somente Admin e Socio Operador podem editar (remover `isGerenteUnidade` do acesso ao editor inline)
4. **Proteger com senha**: Manter o fluxo de confirmacao de senha existente

### Arquivos a editar
| Arquivo | Mudanca |
|---------|---------|
| `src/components/InlineBudgetEditor.tsx` | Adicionar botao de lapiz na tabela, carregar valores existentes ao clicar, try/catch no submit, remover gerente do acesso |
| `src/components/OperationalBudgetConfigSection.tsx` | Adicionar botao de lapiz na tabela de budgets, carregar valores para edicao, try/catch no submit |
| `src/hooks/useStoreBudgets.ts` | Adicionar logs de erro mais detalhados |

### Logica do botao de edicao
- Na tabela de budgets ativos, cada linha tera um icone de lapiz ao lado do icone de lixeira
- Ao clicar no lapiz: preenche `selectedStoreId`, `selectedMonthYear` e todos os campos de valor com os dados do budget existente
- O formulario passa a funcionar como "edicao" (upsert ja cobre isso naturalmente)
- Fluxo de senha se aplica antes de qualquer alteracao

---

## Problema 2: Filtros aplicando valores errados com alto volume

### Diagnostico
O `BudgetsGerenciaisTab` inicializa o filtro com `lojaId: selectedUnidadeId` mas a funcao `isInDateRange` e definida inline (nao memoizada) e depende de `effectiveDateRange`. O `useMemo` do `filteredFreelancers` lista `filters.dateStart` e `filters.dateEnd` nas dependencias, mas usa `isInDateRange` que captura `effectiveDateRange` por closure. Isso pode causar **stale closures** quando o estado muda rapidamente.

Alem disso, o default do filtro e o mes atual (`startOfMonth` a `endOfMonth`), mas quando o usuario muda o periodo, a funcao `isInDateRange` pode estar usando o range antigo na primeira renderizacao.

### Solucao
1. **Memoizar `isInDateRange`** com `useCallback` ou mover a logica diretamente para dentro dos `useMemo` dos filtros
2. **Incluir `effectiveDateRange` nas dependencias** dos `useMemo` de filtragem para evitar stale closures
3. **Garantir que o estado de filtro reseta corretamente** ao trocar de unidade

### Arquivos a editar
| Arquivo | Mudanca |
|---------|---------|
| `src/components/dashboard/BudgetsGerenciaisTab.tsx` | Refatorar `isInDateRange` para dentro dos useMemo, corrigir dependencias, resetar filtros ao trocar unidade |

---

## Resumo de impacto
- **6 pontos de mudanca** em 4 arquivos
- Zero mudancas no banco de dados (estrutura ja esta correta)
- Foco em robustez do salvamento e consistencia dos filtros

