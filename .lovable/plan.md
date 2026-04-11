

# Plano: Módulo Estoque Geral (Parte 2)

## 1. Schema Supabase — 5 novas tabelas via migração

Tabelas existentes confirmadas: `items_catalog`, `utensilios_*` (5 tabelas da Parte 1) + `sectors` (escalas, não será tocada).

Novas tabelas a criar:

| Tabela | Campos principais | Notas |
|--------|-------------------|-------|
| `setores` | id, nome, descricao, loja_id, is_active | Seed: Estoque, Cozinha, Parrilla, Bar, Salão |
| `setor_items` | id, catalog_item_id (FK), setor_id (FK), loja_id, estoque_minimo, estoque_maximo, ponto_pedido, is_active | unique(catalog_item_id, setor_id, loja_id) |
| `inventarios` | id, setor_id (FK), loja_id, tipo, turno, data_inventario, semana_referencia, responsavel, status | |
| `inventario_items` | id, inventario_id (FK), setor_item_id (FK), quantidade_anterior, quantidade_contada, variacao (GENERATED), observacao | variacao = quantidade_contada - quantidade_anterior |
| `movimentacoes_estoque` | id, setor_item_id (FK), loja_id, tipo_movimentacao, quantidade, setor_destino_id (FK nullable), data_movimentacao, responsavel, observacao | |

Detalhes:
- `loja_id` adicionado a `setores`, `setor_items`, `inventarios` e `movimentacoes_estoque` para RLS multi-loja
- RLS: admin full access, gestores read/write nas suas unidades via `user_has_access_to_loja`
- `inventario_items.variacao` usa `GENERATED ALWAYS AS (quantidade_contada - quantidade_anterior) STORED`
- Seed dos 5 setores inserido na mesma migração (sem loja_id, servem como template global)

## 2. Navegação — adicionar tab "ESTOQUE"

| Arquivo | Mudança |
|---------|---------|
| `src/components/layout/AppSidebar.tsx` | Adicionar "ESTOQUE GERAL" no `menuItems` com ícone `Warehouse` |
| `src/components/layout/BottomNavigation.tsx` | Adicionar item na nav mobile |
| `src/pages/Index.tsx` | Adicionar `estoque` no `tabConfig` + case no switch para `EstoqueTab` |

## 3. Componentes do módulo

| Arquivo | Descrição |
|---------|-----------|
| `src/components/estoque/EstoqueTab.tsx` | Container com 4 sub-abas |
| `src/components/estoque/VisaoConsolidada.tsx` | Cards por setor + tabela com filtros e badges de status |
| `src/components/estoque/Movimentacao.tsx` | Form de nova movimentação + histórico filtrado |
| `src/components/estoque/Inventarios.tsx` | Novo inventário + contagem + comparativo semanal |
| `src/components/estoque/CatalogoItens.tsx` | Lista de items_catalog com filtros, vínculo a setores, badge utensílio |
| `src/components/estoque/index.ts` | Barrel export |
| `src/hooks/useEstoque.ts` | Hook para CRUD de setor_items, inventários, movimentações e saldo calculado |

## 4. Lógica de saldo em tempo real

O saldo atual de cada `setor_item` será calculado no frontend:
1. Pega a última contagem do item (via `inventario_items`)
2. Soma movimentações posteriores (entradas +, saídas -)
3. Resultado = quantidade_contada + sum(entradas) - sum(saídas)

Status: OK (saldo >= mínimo), Alerta (saldo < mínimo), Crítico (saldo < ponto_pedido).

## 5. O que NÃO será alterado

- Nenhuma tabela existente (items_catalog, utensilios_*, CMV, escalas, sectors)
- Nenhum hook existente
- Nenhum arquivo em `src/lib/`, `src/contexts/`, `src/integrations/`
- Rotas do `App.tsx`
- Módulo de Utensílios (componentes e hook)

## Arquivos impactados (existentes)

| Arquivo | Tipo |
|---------|------|
| `src/pages/Index.tsx` | Adicionar tab + case |
| `src/components/layout/AppSidebar.tsx` | Menu item |
| `src/components/layout/BottomNavigation.tsx` | Nav mobile |

## Arquivos criados (novos)

- `src/components/estoque/EstoqueTab.tsx`
- `src/components/estoque/VisaoConsolidada.tsx`
- `src/components/estoque/Movimentacao.tsx`
- `src/components/estoque/Inventarios.tsx`
- `src/components/estoque/CatalogoItens.tsx`
- `src/components/estoque/index.ts`
- `src/hooks/useEstoque.ts`

