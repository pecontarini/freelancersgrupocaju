

# Plano: Todos os utensílios pré-carregados + Estoque Inicial

## Problema
- 229 itens UT existem no `items_catalog`, mas **0 registros** em `utensilios_items` — nenhuma loja tem utensílios configurados
- A aba de Contagem mostra "Nenhum item configurado" porque depende de `utensilios_items` ter dados
- Não existe forma de definir estoque inicial antes de começar contagens

## Mudanças

### 1. Reescrever a aba de Contagem para usar `items_catalog` diretamente
Em vez de depender de `utensilios_items` (que está vazio), a tela de contagem listará todos os 229 itens diretamente do `items_catalog WHERE is_utensilio = true`. Isso garante que todos os utensílios apareçam imediatamente, sem pré-configuração.

### 2. Botão "Definir Estoque Inicial" na aba principal
- Novo botão visível no `UtensiliosTab` que abre um modal/dialog
- O dialog lista todos os 229 itens UT com campo de input para quantidade inicial
- Ao salvar, faz **bulk insert** em `utensilios_items` para a loja selecionada (catalog_item_id, loja_id, estoque_minimo = valor informado)
- Se a loja já tem itens configurados, o botão muda para "Ajustar Estoques" e permite editar os mínimos existentes

### 3. Novo hook: `useBulkCreateUtensiliosItems`
- Mutation que recebe array de `{ catalog_item_id, loja_id, estoque_minimo }` e faz upsert em `utensilios_items`
- Invalida queries relacionadas após sucesso

### 4. Ajustar `ContagemSemanal` para funcionar com catálogo direto
- Usa `useUtensiliosCatalog()` (229 itens do `items_catalog`) como lista principal
- Se existir `utensilios_items` para a loja, cruza para pegar o `estoque_minimo` configurado
- Se não existir, mostra o item mesmo assim (sem mínimo definido, badge cinza "Sem mínimo")

## Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useUtensilios.ts` | Adicionar `useBulkCreateUtensiliosItems` e `useUpdateUtensilioItem` |
| `src/components/utensilios/UtensiliosTab.tsx` | Botão "Definir Estoque Inicial" + dialog com lista completa |
| `src/components/utensilios/ContagemSemanal.tsx` | Usar catálogo direto em vez de depender de `utensilios_items` |

## O que NÃO será alterado
- Schema do banco (as tabelas já existem e servem)
- Outros módulos
- Estoque Geral (ignorado conforme solicitado)

