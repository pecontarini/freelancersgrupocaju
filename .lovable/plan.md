

# Plano: Corrigir seleção de unidade no Quadro Operacional + Visão Global Admin

## Problema

1. **Seletor de unidade não funciona**: O componente `OperationalDashboard` usa `useConfigLojas()` para listar lojas, mas não faz filtragem por perfil. Gerentes e operadores veem o dropdown vazio ou com lojas que não são deles, e não há auto-seleção.

2. **Admin sem visão global**: Hoje o admin precisa selecionar uma unidade por vez. Falta uma visão consolidada mostrando o quadro operacional de todas as unidades simultaneamente.

## Solução

### 1. Corrigir seletor de unidade com lógica de perfil

No `OperationalDashboard.tsx`:

- Importar `useUserProfile` para obter `isAdmin`, `isOperator`, `unidades`
- **Admin**: mostrar todas as lojas via `useConfigLojas()` + opção "Todas as unidades"
- **Operador/Gerente**: mostrar apenas `unidades` do perfil
- **Auto-seleção**: se o usuário tem apenas 1 unidade, selecionar automaticamente
- Padrão já usado em `ManualScheduleGrid`, `UnidadeSelector`, etc.

### 2. Criar visão global para admin (opção "Todas as unidades")

Quando admin seleciona "Todas as unidades":
- Iterar sobre todas as lojas e renderizar um card resumo por unidade
- Cada card mostra: nome da unidade, meta total, escalados, presentes, % de preenchimento
- Clicar num card filtra para aquela unidade (drill-down)
- Layout em grid responsivo, similar ao `UnitSummaryGrid` já existente

### Arquivo impactado

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/OperationalDashboard.tsx` | Refatorar seletor + adicionar visão global |

### Resultado

- Gerentes/operadores veem e selecionam apenas suas lojas, com auto-seleção quando têm uma só
- Admin tem dropdown com todas as lojas + "Todas as unidades"
- Na visão global, admin vê um painel consolidado com cards por unidade e drill-down

