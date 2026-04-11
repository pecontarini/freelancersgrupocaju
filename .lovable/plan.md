

# Plano: Otimizar Estoque Geral e Utensílios para Mobile

## Problema
Todos os componentes de Estoque e Utensílios usam `<Table>` com 7-9 colunas, ilegíveis em telas de 440px. Além disso, "Utensílios" não está acessível na navegação mobile.

## Mudanças

### 1. Navegação mobile — adicionar Utensílios
O bottom nav já tem 5 itens + Perfil (limite ergonômico). Adicionar "Utensílios" no menu hamburger (Sheet lateral direita) junto com as outras opções admin, acessível para todos os perfis.

| Arquivo | Mudança |
|---------|---------|
| `src/components/layout/BottomNavigation.tsx` | Adicionar botão "Utensílios" na Sheet do menu lateral |

### 2. Sub-abas responsivas — texto compacto
As TabsList de 4 colunas (Estoque) e 3 colunas (Utensílios) ficam apertadas em mobile. Usar texto curto e scroll horizontal.

| Arquivo | Mudança |
|---------|---------|
| `EstoqueTab.tsx` | TabsList com `overflow-x-auto` e labels curtas em mobile |
| `UtensiliosTab.tsx` | Idem |

### 3. Estoque — Visão Consolidada mobile
Substituir a tabela de 9 colunas por cards empilhados quando `isMobile`:
- Cada card mostra: nome do item, setor (badge), saldo vs mínimo, custo, status badge
- Filtros empilhados verticalmente em mobile
- Cards de setor mantêm grid 2 colunas (já funciona)

| Arquivo | Mudança |
|---------|---------|
| `src/components/estoque/VisaoConsolidada.tsx` | Renderização condicional: cards no mobile, tabela no desktop |

### 4. Estoque — Movimentação mobile
- Formulário já usa `grid-cols-1 md:grid-cols-4` (OK)
- Tabela de histórico: substituir por cards com ícone de tipo, nome do item, quantidade e data

| Arquivo | Mudança |
|---------|---------|
| `src/components/estoque/Movimentacao.tsx` | Cards no histórico quando mobile |

### 5. Estoque — Inventários mobile
- Dialog de novo inventário já funciona
- Tabela de contagem ativa: converter em cards por item (nome, anterior, input contagem, variação)
- Tabela de histórico: converter em cards compactos

| Arquivo | Mudança |
|---------|---------|
| `src/components/estoque/Inventarios.tsx` | Cards mobile para contagem e histórico |

### 6. Estoque — Catálogo de Itens mobile
- Tabela com 6+ colunas: converter em cards
- Cada card: nome, código, grupo, custo, badges de setores vinculados, botões de ação
- Filtros em layout vertical
- Paginação mantida

| Arquivo | Mudança |
|---------|---------|
| `src/components/estoque/CatalogoItens.tsx` | Cards mobile + filtros verticais |

### 7. Utensílios — Contagem Semanal mobile
- Tabela de 5 colunas → cards por item: nome, código, mínimo, input de contagem, badge de status
- Filtros (semana, turno) empilhados

| Arquivo | Mudança |
|---------|---------|
| `src/components/utensilios/ContagemSemanal.tsx` | Cards mobile |

### 8. Utensílios — Controle de Budget mobile
- Cards de resumo já usam `grid-cols-2` (OK)
- Tabela de alocação: converter em cards com item, déficit, custo, qtd aprovada, badge de status

| Arquivo | Mudança |
|---------|---------|
| `src/components/utensilios/ControleBudget.tsx` | Cards mobile na tabela de alocação |

### 9. Utensílios — Histórico mobile
- Tabela comparativa: converter em cards com abertura/fechamento lado a lado e variação destacada

| Arquivo | Mudança |
|---------|---------|
| `src/components/utensilios/HistoricoContagens.tsx` | Cards mobile |

## Padrão técnico
Todos os componentes usarão `useIsMobile()` do hook existente. Quando `isMobile = true`, renderizam cards em vez de tabelas. Nenhum componente novo será criado — apenas adaptação dos existentes com renderização condicional.

## Arquivos impactados (10)
- `src/components/layout/BottomNavigation.tsx`
- `src/components/estoque/EstoqueTab.tsx`
- `src/components/estoque/VisaoConsolidada.tsx`
- `src/components/estoque/Movimentacao.tsx`
- `src/components/estoque/Inventarios.tsx`
- `src/components/estoque/CatalogoItens.tsx`
- `src/components/utensilios/UtensiliosTab.tsx`
- `src/components/utensilios/ContagemSemanal.tsx`
- `src/components/utensilios/ControleBudget.tsx`
- `src/components/utensilios/HistoricoContagens.tsx`

## O que NÃO será alterado
- Nenhum hook, schema, migração ou rota
- Lógica de dados permanece idêntica
- Layout desktop permanece intacto

