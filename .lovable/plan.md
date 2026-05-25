# Plano revisado: migrar para `pop_status_diario` RPC

## Objetivo

Substituir a montagem manual de Meta/Escalados/Presentes pela RPC `pop_status_diario(p_data)` em:

1. **AdminGlobalView** — "Quadro Operacional — Todas as Unidades"
2. **OperationalDashboard** — bloco "Visão Geral por Setor" + KPIs Total

## Mapeamento de campos

| Card UI       | Fonte (RPC)                           |
|---------------|---------------------------------------|
| Meta          | `SUM(pop_total)`                      |
| Escalados     | `SUM(escalados_clt)`                  |
| Presentes     | `SUM(ponto_clt + checkin_free)`       |
| Status/cor    | campo `status` agregado               |

## Mapeamento de status (4 valores)

| Valor RPC        | Cor / UI                                                       |
|------------------|----------------------------------------------------------------|
| `VERMELHO`       | vermelho (déficit)                                             |
| `AMARELO`        | amarelo (excesso = custo)                                      |
| `VERDE_RESSALVA` | verde com Badge/Tooltip **"Mix desviado"** (CLT/Free fora do plano) |
| `VERDE_PURO`     | verde sólido (composição certa)                                |

**Agregação pior→melhor:** `VERMELHO > AMARELO > VERDE_RESSALVA > VERDE_PURO`. Em uma unidade/setor com várias linhas, o agregado vira o pior status encontrado.

## Implementação

### 0. Migration: GRANT EXECUTE

Antes de qualquer código, rodar migration:

```sql
GRANT EXECUTE ON FUNCTION public.pop_status_diario(DATE)
  TO authenticated, anon, service_role;
```

Sem isso, a RPC retorna `42501: permission denied`.

### 1. Hook `usePopStatusDiario`

Arquivo: `src/hooks/usePopStatusDiario.ts`

```ts
useQuery({
  queryKey: ['pop-status-diario', data],
  queryFn: () => supabase.rpc('pop_status_diario', { p_data: data }),
  staleTime: 60_000,
  refetchInterval: 5 * 60_000,        // 5min — batidas Secullum + check-ins free
  refetchIntervalInBackground: false, // só com aba ativa
})
```

Tipagem da linha retornada inclui todos os campos da function (incluindo `status` e `status_detalhe`).

Helper exportado: `aggregateStatus(rows)` retorna o pior status seguindo a ordem acima.

### 2. `AdminGlobalView.tsx`

- Remover o `useEffect` que faz 4 queries (sectors / shifts / matrix / schedules / attendance).
- Consumir `usePopStatusDiario(today)`, filtrar `refeicao === shiftType`, agrupar por `unit_id`.
- Para cada unidade:
  - `meta = SUM(pop_total)`
  - `escalados = SUM(escalados_clt)`
  - `presentes = SUM(ponto_clt + checkin_free)`
  - `status = aggregateStatus(linhas)`
- Cores do Badge derivam do status (4 valores). `VERDE_RESSALVA` adiciona ícone/tooltip "Mix desviado".

### 3. `OperationalDashboard.tsx` (apenas ramo `isAllSectors`)

- Adicionar `usePopStatusDiario(today)`, filtrar `unit_id === selectedUnit && refeicao === shiftType`.
- Substituir `sectorStats` por agregação por `sector_id` com os campos da RPC.
- Recalcular `totalMeta`, `totalEscalados`, `totalPresentes` a partir dos novos valores.
- Cards por setor usam o status da RPC (4 cores).
- KPI "Presentes Total" passa a usar a cor agregada (não a heurística 70%).

**Preservado intacto:**
- Ramo de setor único (marcar presença, justificativas) — continua com `useSchedulesBySector` + `useAttendance` por precisar do `schedule_id`.
- Filtros, header, botão "Gerar Resumo Consolidado" (reusa os novos totais automaticamente).

### 4. Limpeza

- `AdminGlobalView`: remover import direto de `supabase` e estado de loading manual.
- `OperationalDashboard`: manter `useStaffingMatrix`/`useSchedulesBySector`/`useAttendance` (ainda usados no ramo de setor único).

## Observações (não bloqueiam)

- **MULT 03 / NFE 04**: vão aparecer vermelhas falsas (problema cross-unit pendente da 8.3.1). Aceitar agora, tratar com indicador "dados em consolidação" em iteração separada.
- **Turno = refeicao**: function retorna apenas `ALMOCO`/`JANTAR`. Outros valores de turno na UI ficam zerados — confirmar que hoje só há esses dois botões.

## Arquivos

- **Migration:** `GRANT EXECUTE` em `pop_status_diario(DATE)`
- **Criar:** `src/hooks/usePopStatusDiario.ts`
- **Editar:** `src/components/escalas/AdminGlobalView.tsx`
- **Editar:** `src/components/escalas/OperationalDashboard.tsx` (apenas bloco `isAllSectors`)
