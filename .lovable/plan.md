
## Plano: Acesso Rapido para Editar Budgets na Aba Budgets Gerenciais

### Objetivo

Adicionar um botao discreto na aba principal (Budgets Gerenciais), proximo ao card de "Consumo do Budget Diario", que permite ao Socio Operador ou Gerente de Unidade abrir um dialog para cadastrar ou editar os budgets da sua loja — protegido por confirmacao de senha.

### Fluxo do usuario

1. Na aba "Budgets Gerenciais", o usuario ve um botao "Editar Budgets" ao lado do titulo "Consumo do Budget Diario"
2. Ao clicar, aparece um dialog pedindo a senha da conta (confirmacao de identidade)
3. Ao digitar a senha correta, o sistema valida via autenticacao e abre o formulario completo de budgets (mesmo formulario que existe em Configuracoes)
4. O usuario cadastra ou edita os valores e salva
5. O dialog fecha e os dados da tela atualizam automaticamente

### Mudancas

**1. Novo componente — `src/components/InlineBudgetEditor.tsx`**

Componente que encapsula:
- Botao de gatilho (icone de engrenagem ou lapis, discreto)
- Dialog de confirmacao de senha:
  - Input de senha
  - Botao "Confirmar"
  - Validacao via `supabase.auth.signInWithPassword` usando o email do usuario logado
  - Em caso de erro, mostra mensagem "Senha incorreta"
- Apos autenticacao, exibe o formulario de budget (reutilizando a logica do `BudgetConfigSection`):
  - Seletor de mes
  - Campos para cada categoria (Freelancers, Manutencao, Uniformes, Limpeza, Utensilios)
  - Loja pre-selecionada (a loja ativa no filtro ou a unica do usuario)
  - Tabela dos budgets ativos da loja
  - Botoes salvar/excluir

**2. Integracao na aba — `src/components/dashboard/BudgetsGerenciaisTab.tsx`**

- Importar o `InlineBudgetEditor`
- Renderiza-lo ao lado do card "Consumo do Budget Diario", visivel apenas para `isOperator` ou `isGerenteUnidade`
- Passar `effectiveStoreId` para pre-selecionar a loja

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/InlineBudgetEditor.tsx` | Novo componente com dialog de senha + formulario de budgets |
| `src/components/dashboard/BudgetsGerenciaisTab.tsx` | Importar e renderizar o editor inline, visivel para operator/gerente |

### Seguranca

- A senha e validada server-side via `supabase.auth.signInWithPassword` — nao e uma senha fixa nem client-side
- Apos a validacao, a sessao ja existente do usuario continua ativa (o signIn apenas confirma a identidade)
- O componente so aparece para usuarios com role `operator` ou `gerente_unidade`
- As policies RLS existentes na tabela `store_budgets` garantem que o usuario so acessa lojas vinculadas

### Visual

```text
+------------------------------------------+
| Consumo do Budget Diario    [85%] [Editar Budgets]  |
| ████████████████░░░░                      |
| Consumido: R$ 1.200   Disponivel: R$ 200 |
+------------------------------------------+

Ao clicar "Editar Budgets":

+--- Dialog: Confirme sua senha -----------+
| Para editar os budgets, confirme sua     |
| senha de acesso.                         |
|                                          |
| Senha: [••••••••••]                      |
|                                          |
|            [Cancelar]  [Confirmar]        |
+------------------------------------------+

Apos confirmar:

+--- Dialog: Editar Budgets ---------------+
| Loja: Unidade Centro  Mes: fevereiro 2026|
|                                          |
| Freelancers:  [R$ 5.000]                 |
| Manutencao:   [R$ 3.000]                 |
| Uniformes:    [R$ 1.000]                 |
| Limpeza:      [R$ 800]                   |
| Utensilios:   [R$ 1.200]                 |
|                                          |
| Budget Total: R$ 11.000                  |
|                                          |
| [Budgets ativos - tabela]                |
|                                          |
|            [Cancelar]  [Salvar]           |
+------------------------------------------+
```
