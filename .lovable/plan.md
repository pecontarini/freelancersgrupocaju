# Plano: Módulo de Controle de Utensílios (Parte 1)

## Contexto

O app usa navegação por tabs dentro de `Index.tsx` — não rotas separadas. O novo módulo será adicionado como uma nova tab "utensilios" no menu lateral e no switch de renderização, seguindo o padrão existente.

## 1. Schema Supabase — 5 tabelas via migração

Criar as 5 tabelas conforme especificado: `items_catalog`, `utensilios_config`, `utensilios_items`, `utensilios_contagens`, `utensilios_pedidos`.

Detalhes técnicos:

- `utensilios_config.budget_mensal` e `utensilios_pedidos.custo_pedido` usam `GENERATED ALWAYS AS ... STORED`
- RLS habilitado em todas as tabelas com políticas: admin full access, gestores read/write nas suas unidades
- Nota: `utensilios_contagens` e `utensilios_pedidos` não têm campo `loja_id` no spec original — vou adicioná-lo para compatibilidade com RLS multi-loja

## 2. Navegação — adicionar tab "UTENSÍLIOS"


| Arquivo                                      | Mudança                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/components/layout/AppSidebar.tsx`       | Adicionar item "UTENSÍLIOS" no `menuItems` com ícone `UtensilsCrossed`            |
| `src/components/layout/BottomNavigation.tsx` | Adicionar item na nav mobile                                                      |
| `src/pages/Index.tsx`                        | Adicionar entrada em `tabConfig`, importar e renderizar `UtensiliosTab` no switch |


## 3. Componentes do módulo

Criar os seguintes arquivos:


| Arquivo                                            | Descrição                                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/components/utensilios/UtensiliosTab.tsx`      | Container principal com 3 sub-abas                                                                                |
| `src/components/utensilios/ContagemSemanal.tsx`    | Aba 1: contagem por turno, agrupada por categoria, com indicadores verde/vermelho vs mínimo                       |
| `src/components/utensilios/ControleBudget.tsx`     | Aba 2: 4 cards de resumo + parâmetros editáveis + tabela de alocação com lógica de prioridade + geração de pedido |
| `src/components/utensilios/HistoricoContagens.tsx` | Aba 3: filtro por semana, tabela comparativa abertura/fechamento/variação                                         |
| `src/components/utensilios/index.ts`               | Barrel export                                                                                                     |
| `src/hooks/useUtensilios.ts`                       | Hook para CRUD de items, contagens, config e pedidos                                                              |


## 4. Lógica de alocação de budget (Aba 2)

A alocação percorre os itens em ordem de `ordem_prioridade`. Para cada item:

1. Calcula déficit = max(0, estoque_minimo - estoque_atual)
2. Calcula custo para repor = déficit × valor_unitario
3. Se budget restante >= custo: qtd_aprovada = déficit, status = "Pedir Total"
4. Se budget restante > 0 mas < custo: qtd_aprovada = floor(budget/valor_unitario), status = "Parcial"
5. Se budget = 0: qtd_aprovada = 0, status = "Sem Budget"
6. Se déficit = 0: status = "OK"

O botão "Gerar Pedido" cria registros em `utensilios_pedidos`.

## 5. Seed data

Sem dados de seed automáticos nesta migração (os 74 itens e 1.289 do catálogo virão em importação posterior ou via insert manual)  
Importante que os itens estão todos nos 1289 e os 74 iniciais precisam de um depara para cruzamento e não ficar duplicado. Vamos usar só os itens que tiverem na nomeclatura UT na frente e usar apenas o banco de dados dos 1289 ignorando os 74 itens que estão separados. As tabelas ficam prontas para receber dados.

## Arquivos impactados (existentes)


| Arquivo                                      | Tipo de mudança                       |
| -------------------------------------------- | ------------------------------------- |
| `src/pages/Index.tsx`                        | Adicionar tab config + case no switch |
| `src/components/layout/AppSidebar.tsx`       | Adicionar menu item                   |
| `src/components/layout/BottomNavigation.tsx` | Adicionar item mobile                 |


## Arquivos criados (novos)

- `src/components/utensilios/UtensiliosTab.tsx`
- `src/components/utensilios/ContagemSemanal.tsx`
- `src/components/utensilios/ControleBudget.tsx`
- `src/components/utensilios/HistoricoContagens.tsx`
- `src/components/utensilios/index.ts`
- `src/hooks/useUtensilios.ts`

## O que NÃO será alterado

- Nenhuma tabela existente (CMV, escalas, budgets)
- Nenhum hook existente
- Nenhum arquivo em `src/lib/`, `src/contexts/`, `src/integrations/`
- Rotas do `App.tsx`