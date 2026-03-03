
# Correcoes Definitivas: Budgets, Freelancer e Anexos de Manutencao

## Problema 1: Socios Operadores nao conseguem registrar budgets

**Causa raiz encontrada**: A politica RLS da tabela `store_budgets` permite que `gerente_unidade` apenas LEIA budgets (SELECT), mas nao grave. Porem, a interface permite que eles cliquem em "Editar Budgets". Ja o perfil `operator` possui politica ALL correta. Se alguns socios reportam erro, pode ser que estejam cadastrados como `gerente_unidade` em vez de `operator`. Para resolver de vez, vamos adicionar politica de INSERT/UPDATE para `gerente_unidade` tambem.

**Solucao**:
- Criar migration SQL adicionando politica INSERT e UPDATE em `store_budgets` para `gerente_unidade` com restricao a suas lojas vinculadas

## Problema 2: Tela "volta" apos cadastrar freelancer

**Causa raiz encontrada**: No `FreelancerForm.tsx`, o `form.reset()` (linha 106) limpa todos os campos de uma vez, causando re-render completo do componente. Isso faz o formulario "saltar" para o topo ou perder o foco visual. Alem disso, o `createEntry.mutateAsync` pode causar scroll involuntario ao invalidar queries e re-renderizar a lista abaixo.

**Solucao**:
- Envolver o submit em try/catch para evitar que erros propaguem e causem comportamento inesperado
- Usar `window.scrollTo` ou `scrollIntoView` para manter o formulario visivel apos o reset
- Adicionar uma referencia ao formulario e rolar ate ele apos o submit bem-sucedido, garantindo que o usuario continue no mesmo ponto para lancar o proximo

### Arquivo: `src/components/FreelancerForm.tsx`
- Adicionar `useRef` no card do formulario
- No `onSubmit`, envolver em try/catch e apos o reset, chamar `formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })`

## Problema 3: Apenas um campo de anexo na manutencao (usuario nao ve NF e Boleto separados)

**Causa raiz encontrada**: O codigo JA possui dois campos de upload (NF e Boleto), porem o primeiro esta rotulado como "Anexo (Boleto/NF)" -- um label confuso que faz o usuario pensar que e um campo unico para tudo. O segundo campo ("Anexo do Boleto") fica abaixo e nao se destaca visualmente. Na pratica, o usuario percebe apenas um campo.

**Solucao**:
- Renomear o primeiro upload de "Anexo (Boleto/NF)" para "Nota Fiscal (NF)" com icone de FileText
- Renomear o segundo de "Anexo do Boleto (opcional)" para "Boleto" com icone distinto
- Colocar os dois uploads lado a lado em um grid (desktop) para que fiquem visiveis simultaneamente
- Adicionar bordas coloridas distintas: azul para NF, roxo para Boleto
- Manter o OCR apenas no upload da NF

### Arquivo: `src/components/MaintenanceForm.tsx`
- Alterar labels nas linhas 417-419 e 515-517
- Envolver ambos em `div className="grid gap-4 sm:grid-cols-2"` para layout lado a lado
- Estilizar com bordas de cor diferente

---

## Resumo de alteracoes

| Arquivo | Acao |
|---------|------|
| Migration SQL | Adicionar INSERT/UPDATE policies para gerente_unidade em store_budgets |
| `src/components/FreelancerForm.tsx` | Scroll para formulario apos submit + try/catch |
| `src/components/MaintenanceForm.tsx` | Renomear labels, layout side-by-side para NF e Boleto |

## Resultado esperado

1. Tanto operadores quanto gerentes de unidade conseguem salvar budgets
2. Apos salvar freelancer, o formulario limpa mas permanece visivel para o proximo lancamento
3. Na manutencao, NF e Boleto aparecem como dois campos claros e distintos lado a lado
