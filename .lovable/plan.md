
# Plano: Custo unitário nos módulos + validação de dados + funcionalidade

## Diagnóstico

1. **Dados no banco**: 1.288 itens no `items_catalog` (229 com prefixo UT). A planilha pode ter 1.289 — preciso verificar qual está faltando e inserir se necessário.
2. **Campo `preco_custo` ausente**: A tabela `items_catalog` não tem coluna de custo unitário. Sem ela, não há como controlar valor financeiro no estoque geral.
3. **`setor_items` sem custo**: Também não tem campo de custo — o custo deve vir do catálogo (centralizado).
4. **`utensilios_items` já tem `valor_unitario`** — OK para utensílios.
5. **UtensiliosTab é stub** — as 3 abas estão vazias ("em construção").
6. **VisaoConsolidada tem `saldo = 0` hardcoded** — nunca calcula saldo real.
7. **CatalogoItens não mostra/edita custo** — precisa de coluna e campo de edição.

## Mudanças

### 1. Migração: adicionar `preco_custo` ao `items_catalog`
- Adicionar coluna `preco_custo numeric default 0` à tabela `items_catalog`
- Isso centraliza o custo unitário para todos os itens (utensílios e estoque geral)

### 2. Verificar e corrigir item faltante
- Comparar a planilha com o banco para identificar o item #1289 que pode estar ausente
- Inserir via insert tool se confirmado

### 3. UI: Edição de custo no Catálogo de Itens
- Adicionar coluna "Custo Unit." na tabela do `CatalogoItens.tsx`
- No dialog de vincular/editar, adicionar campo "Custo Unitário (R$)"
- Criar mutation `useUpdateCatalogItem` no hook `useEstoque.ts` para atualizar `preco_custo` diretamente no `items_catalog`
- Permitir edição inline ou via botão de editar no catálogo

### 4. UI: Valor financeiro na Visão Consolidada
- Mostrar coluna "Custo Unit." e "Valor Total" (saldo × custo) na tabela consolidada
- Cards de resumo passam a mostrar valor total do estoque por setor

### 5. Funcionalizar o módulo de Utensílios (UtensiliosTab)
- Implementar as 3 sub-abas completas usando os hooks `useUtensilios.ts` (que já existe ou será criado):
  - **Contagem Semanal**: lista de itens UT agrupados por categoria, input de contagem, indicador verde/vermelho vs mínimo, salvar por turno
  - **Controle de Budget**: cards de resumo + tabela de alocação por prioridade + geração de pedido
  - **Histórico**: filtro por semana, tabela comparativa abertura/fechamento
- Os itens de utensílios virão de `items_catalog WHERE is_utensilio = true`, cruzando com `utensilios_items` para os que já têm config operacional

### 6. Conectar saldo real na Visão Consolidada
- Substituir `saldo = 0` por cálculo real: última contagem + entradas - saídas (via `inventario_items` + `movimentacoes_estoque`)

## Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | `ALTER TABLE items_catalog ADD COLUMN preco_custo numeric DEFAULT 0` |
| `src/hooks/useEstoque.ts` | Adicionar `useUpdateCatalogItem` mutation |
| `src/hooks/useUtensilios.ts` | Criar hook completo para CRUD de contagens, config e pedidos |
| `src/components/estoque/CatalogoItens.tsx` | Coluna custo + campo edição + botão editar item |
| `src/components/estoque/VisaoConsolidada.tsx` | Colunas de custo/valor + saldo real |
| `src/components/utensilios/UtensiliosTab.tsx` | Implementação completa das 3 abas |
| `src/components/utensilios/ContagemSemanal.tsx` | Criar componente |
| `src/components/utensilios/ControleBudget.tsx` | Criar componente |
| `src/components/utensilios/HistoricoContagens.tsx` | Criar componente |

## O que NÃO será alterado
- Nenhuma tabela existente além de `items_catalog` (apenas ADD COLUMN)
- Nenhum módulo existente (CMV, escalas, budgets)
- Rotas do `App.tsx`
