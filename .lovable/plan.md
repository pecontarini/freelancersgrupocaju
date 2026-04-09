

# Plano: Visão Geral do Quadro Operacional (todos os setores)

## Objetivo

Adicionar uma opção "Visão Geral" ao Quadro Operacional que mostra, numa única tela, o status de **todos os setores** da unidade para o turno selecionado — sem precisar navegar setor a setor.

## O que muda

### `OperationalDashboard.tsx`

1. **Filtro de Setor**: Adicionar opção "Todos os setores" como valor padrão no seletor. Quando selecionada, exibe a visão geral; ao escolher um setor específico, mantém o comportamento atual (lista de conferência individual).

2. **Busca de dados na visão geral**: Quando "Todos os setores" estiver ativo, buscar schedules de **todos os sectorIds** da unidade (já suportado pelo hook `useSchedulesBySector`).

3. **Visão Geral — Cards por setor**: Renderizar um grid de cards, um por setor, cada um mostrando:
   - Nome do setor
   - Meta POP (da staffing matrix)
   - Escalados (schedules do dia/turno)
   - Presentes (attendance com status "presente")
   - Badge de status visual (verde = completo, amarelo = parcial, vermelho = crítico)
   - Barra de progresso

4. **KPIs consolidados no topo**: Mostrar totais da unidade (Meta total, Escalados total, Presentes total) nos cards de KPI existentes.

5. **Botão "Gerar Resumo"**: Na visão geral, gera o resumo consolidado de todos os setores para copiar no WhatsApp.

## Fluxo visual

```text
┌─────────────────────────────────────────────┐
│  Unidade: [Caju X]   Setor: [Todos ▼]      │
│  Turno: [Almoço]                            │
├─────────────────────────────────────────────┤
│  [Meta: 42]   [Escalados: 38]  [Presentes: 35] │
├─────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Salão    │ │ Bar      │ │ Cozinha  │    │
│  │ 12/15 ⚠️ │ │ 8/8  ✅  │ │ 15/19 🔴 │    │
│  │ ████░░░  │ │ ████████ │ │ █████░░░ │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│                                             │
│  Clique num setor para ver detalhes →       │
└─────────────────────────────────────────────┘
```

## Arquivo impactado

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/OperationalDashboard.tsx` | Adicionar visão geral consolidada |

Nenhuma mudança de banco necessária — usa os mesmos hooks existentes.

