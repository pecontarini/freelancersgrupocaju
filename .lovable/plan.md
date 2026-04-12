

# Plano: Módulo de Utensílios Completo e Funcional

## Resumo
Três grandes adições: (1) tela de contagem isolada para o responsável, (2) dashboard analítico de diferenças/desperdício, (3) vínculo de utensílio com setor operacional. Além disso, reestruturar as abas para cobrir o fluxo completo.

## Mudanças

### 1. Migração: adicionar `setor` ao `utensilios_items`
A tabela já tem `area_responsavel` (text, default 'Salão'). Vou reutilizar esse campo existente e padronizar os valores para: Cozinha, Bar, Salão, Parrilla, Sushi. Não precisa de migração nova — apenas garantir que o código use os 5 setores corretamente.

### 2. Nova rota: `/contagem-utensilios` — Tela exclusiva de contagem
- Página pública (sem sidebar, sem tabs extras) — o responsável acessa, seleciona a loja, turno e semana, e vê apenas a lista de itens para contar
- Filtro por setor (Cozinha, Bar, Salão, Parrilla, Sushi)
- Campo de nome do responsável
- Sem acesso a budget, histórico ou configurações
- Salva direto em `utensilios_contagens` com o campo `responsavel` preenchido
- Mobile-first (cards)
- Rota protegida (autenticado) mas sem necessidade de ser admin

### 3. Novo componente: `DashboardUtensilios` — Analytics
Dashboard analítico dentro do `UtensiliosTab` com:
- **Cards KPI**: total de itens abaixo do mínimo, valor total do déficit, itens com maior variação
- **Ranking de maior diferença** entre semanas (abertura vs fechamento, semana atual vs anterior)
- **Top 10 itens mais caros com déficit** — custo do desperdício/perda
- **Filtro por setor** — ver desempenho por área
- **Gráfico de barras** mostrando déficit por setor
- Usa dados de `utensilios_contagens` cruzando com `utensilios_items` + `items_catalog`

### 4. Filtro por setor em todas as abas
- Adicionar filtro de setor (Cozinha, Bar, Salão, Parrilla, Sushi) na Contagem, Budget e Histórico
- Usar `area_responsavel` do `utensilios_items` como base

### 5. Reestruturar `UtensiliosTab` — 4 abas
| Aba | Conteúdo |
|-----|----------|
| Dashboard | KPIs + rankings + gráficos |
| Contagem | Contagem semanal (existente, com filtro por setor) |
| Compras | Controle de budget (existente, com filtro por setor) |
| Histórico | Comparativo semanal (existente, com filtro por setor) |

### 6. Atualizar `useBulkCreateUtensiliosItems` para incluir setor
No dialog de "Definir Estoque Inicial", adicionar campo de setor (select) por item.

## Arquivos

| Tipo | Arquivo |
|------|---------|
| Novo | `src/pages/ContagemUtensilios.tsx` — tela isolada de contagem |
| Novo | `src/components/utensilios/DashboardUtensilios.tsx` — analytics |
| Editar | `src/components/utensilios/UtensiliosTab.tsx` — 4 abas + setor no dialog |
| Editar | `src/components/utensilios/ContagemSemanal.tsx` — filtro por setor |
| Editar | `src/components/utensilios/ControleBudget.tsx` — filtro por setor |
| Editar | `src/components/utensilios/HistoricoContagens.tsx` — filtro por setor |
| Editar | `src/hooks/useUtensilios.ts` — hook de analytics (contagens por setor, rankings) |
| Editar | `src/App.tsx` — adicionar rota `/contagem-utensilios` |
| Editar | `src/components/utensilios/index.ts` — exportar novos componentes |

## O que NÃO será alterado
- Schema do banco (campo `area_responsavel` já existe)
- Módulo de Estoque Geral
- Nenhum outro módulo

