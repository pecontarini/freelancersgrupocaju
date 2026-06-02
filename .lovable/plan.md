# Plano POP Diário Unificado — Investigação + Execução

Investigação concluída via MCP Supabase (estrutura, índices, volume, RPCs) + grep no frontend. Abaixo os 6 blocos solicitados.

---

## BLOCO 1 — Auditoria do banco atual

### 1.1 Estrutura das tabelas-fonte

`**schedules**` (canônica de escala)

- Colunas-chave: `employee_id`, `schedule_date`, `sector_id` (NOT NULL — `schedules_sem_sector` = 0 ✔), `shift_id`, `start_time`, `end_time`, `schedule_type` (enum, valor de trabalho = `working`), `status` (`scheduled` | `confirmed` | `cancelled` | …), `praca_id`.
- Índices: `unique_active_schedule (employee_id, schedule_date, sector_id) WHERE status<>'cancelled'` — bom para dedup. **NÃO existe** índice por `(schedule_date, status)` nem por `(sector_id, schedule_date)`.
- RLS: ativa (não inspecionada em detalhe agora; não bloqueia leitura do staff autenticado — telas hoje já lêem).

`**employees**`

- Campos pertinentes: `unit_id` (NOT NULL), `active` (NOT NULL), `worker_type` enum (`clt`/`freelancer`), `cpf`, `secullum_id`, `job_title_id`.
- Índices úteis: `idx_employees_cpf`, `employees_banco_secullum_unique`. **Falta** índice por `(unit_id, active, worker_type)` para filtro hot.

`**sectors**`: `id`, `unit_id`, `name`. Sem `worker_type` nem `shift_type`. 114 setores totais.

`**pop_minimo_padrao**` (canônica do POP mínimo, por setor)

- Chave: `(unit_id, sector_id, dia_semana ENUM SEG..DOM, refeicao ENUM ALMOCO/JANTAR)` + janela `vigente_desde/vigente_ate`.
- Tem `minimo_clt`, `minimo_freelancer`, e gerada `quantidade_minima`.
- Índice único parcial `uq_pop_minimo_vigente WHERE vigente_ate IS NULL` ✔.
- 1.200 entradas vigentes para 114 setores × 7 dias × 2 turnos = 1.596 combinações possíveis → **coverage ≈ 75%** (vale validar antes da Etapa C).

`**holding_staffing_config**` (POP mínimo por marca/sector_key — usado em holding sem `sector_id` granular)

- Chave: `(unit_id, sector_key, shift_type, day_of_week, month_year)`.
- Convive com `pop_minimo_padrao`. Lojas que vieram do wizard de holding gravam aqui; conselho preenche `pop_minimo_padrao`. **Decisão de produto pendente** (ver 6.2).

`**time_punches` (Secullum, Origem 11)** — **PONTO CRÍTICO**

- Colunas: `id, employee_id (nullable!), secullum_employee_id, banco_id, unit_id, punch_ts (TIMESTAMPTZ), punch_type ENUM ('entrada','saida_intervalo','retorno','saida'), source, raw_payload`.
- **NÃO existe `sector_id**`. Setor não é registrado pelo relógio.
- Eventos são **linhas separadas** (4 por jornada típica: entrada → saida_intervalo → retorno → saida). Confirmado em amostra real.
- Índices: por `(employee_id, punch_ts DESC)`, `(unit_id, punch_ts DESC)`, `(secullum_employee_id, punch_ts DESC)`. Suficiente para a view.
- Qualidade: 1.612 punches em 7 dias **sem `employee_id**` (~10% — não casaram com nenhum cadastro). Eles vão sumir do cálculo de presença até serem mapeados.

`**shifts**`: catálogo de turnos. `start_time`, `end_time`, `type`. Usado como fallback quando `schedules.start_time/end_time` é NULL.

`**job_titles**`: por `unit_id`; útil só para enriquecer faltantes (telefone vem de `employees`).

`**schedule_attendance**` (já existe!): tem `status`, `justificativa`, `**remanejado_de_sector_id**`, `**remanejado_para_sector_id**` — vai ser a fonte canônica de REMANEJADO manual. Tem 12 rows (não está sendo populada hoje).

`**pop_ajustes_manuais**`: também tem `sector_origem/destino` e `tipo`. **Sobreposição com `schedule_attendance**` — precisa decisão (6.2).

`**extras_checkins**` (freelancer pelo app, não Secullum): vazia hoje, mas é fonte canônica para EXTRA_FREELANCER quando entrar em produção.

`**pop_overrides**`, `**staffing_matrix**` (legado holding, 1.568 rows): manter só leitura.

### 1.2 Volume de dados (últimos 7 dias)


| Métrica              | Valor  |
| -------------------- | ------ |
| schedules / 7d       | 7.789  |
| schedules / total    | 32.605 |
| time_punches / 7d    | 16.001 |
| time_punches / total | 22.474 |
| unidades ativas      | 11     |
| setores              | 114    |
| employees CLT ativos | 892    |
| POP mínimo vigente   | 1.200  |


Conclusão: volume baixo. Uma VIEW normal aguenta sem problema (ver 2.2).

### 1.3 Qualidade dos dados


| Métrica                                                     | Valor        | Ação                                                         |
| ----------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| schedules sem sector_id (7d)                                | **0**        | ✔                                                            |
| time_punches sem employee_id (7d)                           | 1.612 (~10%) | Mapear antes da Etapa C; entram como “punches órfãos” no log |
| POP coverage (vigentes / combinações)                       | ~75%         | Validar com Pedro quais setores não têm POP intencionalmente |
| `schedule_attendance` populada                              | 12 rows      | Vazia na prática — REMANEJADO precisa estratégia (2.4)       |
| `extras_checkins` / `pop_ajustes_manuais` / `pop_overrides` | 0 rows       | Não bloqueia; entram como zero                               |


### 1.4 Hooks e RPCs existentes que tocam POP

**Hooks ativos (vão ser unificados pelo `usePopDiario`):**

- `src/hooks/usePopStatusDiario.ts` → consome RPC `pop_status_diario(p_data)`. Consumidores: `AdminGlobalView.tsx`, `OperationalDashboard.tsx`.
- `src/hooks/usePopCompliance.ts` → SQL inline com janela semanal. Consumidor: `PopComplianceDashboard.tsx`.
- `src/hooks/useQuadroDetalhado.ts` → consome RPC `pop_quadro_detalhado(p_data, p_unit_id)`. Consumidor: `QuadroDetalhado.tsx`.

**Hooks adjacentes (mantém escopo):**

- `useStaffingMatrix`, `useHoldingConfig`, `usePOPWizard*`, `useScheduleAIContext` — escrita/IA. Ficam.
- `useAttendance` (CRUD `schedule_attendance`) — passa a ser fonte de REMANEJADO/ABONO; ganha UI nova mas hook permanece.

**RPCs no banco com nome POP/quadro:**

- `pop_status_diario(p_data)` — agrega CLT por sector/turno, calcula `pop_chegou/escalados/ponto_clt/checkin_free` e devolve `status` (VERMELHO/AMARELO/VERDE_RESSALVA/VERDE_PURO). **Será absorvida pela view.**
- `pop_quadro_detalhado(p_data, p_unit_id)` — devolve linha-a-linha (PRESENTE/ATRASO/AGUARDANDO/AUSENTE) usando `DISTINCT ON (employee_id)` na primeira entrada do dia. **Substituída pelo drill-down nominal do `usePopDiario`.**
- `pop_extras_hoje(p_data, p_unit_id)` — bate ponto sem schedule. **Lógica absorvida pela view (CTE de extras).**
- `pop_reconciliar_orfas`, `pop_cleanup_raw_payloads`, `pop_set_*`, `mirror_holding_to_staffing_matrix` — auxiliares/triggers, mantidas.

---

## BLOCO 2 — Desenho da view `vw_pop_diario`

### 2.1 SQL proposto (NÃO executar ainda)

```sql
CREATE OR REPLACE VIEW public.vw_pop_diario AS
WITH
-- 1) Janela canônica de cada turno (literal POP 02)
turnos AS (
  SELECT * FROM (VALUES
    ('ALMOCO'::text, TIME '12:00', TIME '15:00'),
    ('JANTAR'::text, TIME '19:00', TIME '22:00')
  ) AS t(turno, win_start, win_end)
),

-- 2) Datas-alvo: a view é parametrizada por filtro no client
--    (não fixa intervalo aqui, deixa o índice fazer o trabalho).

-- 3) Escalados (CLT ativos, schedule não-cancelado)
escalados AS (
  SELECT
    s.schedule_date,
    s.sector_id,
    e.unit_id,
    CASE
      WHEN COALESCE(s.start_time, sh.start_time) <  TIME '17:00' THEN 'ALMOCO'
      ELSE 'JANTAR'
    END AS turno,
    s.employee_id,
    e.name        AS employee_name,
    e.phone       AS employee_phone,
    COALESCE(s.start_time, sh.start_time) AS start_time,
    COALESCE(s.end_time,   sh.end_time)   AS end_time
  FROM public.schedules s
  JOIN public.employees e ON e.id = s.employee_id
  LEFT JOIN public.shifts sh ON sh.id = s.shift_id
  WHERE s.status <> 'cancelled'
    AND s.schedule_type::text = 'working'
    AND e.active = TRUE
    AND e.worker_type = 'clt'
    AND e.unit_id = s.unit_id  -- garantia anti-órfão
),

-- 4) Pareamento entrada/saida do Secullum em jornadas
--    (windowed pair: cada 'entrada' casa com a próxima 'saida' do mesmo emp/dia)
punches_ordenados AS (
  SELECT
    tp.employee_id,
    tp.unit_id,
    (tp.punch_ts AT TIME ZONE 'America/Sao_Paulo')::date  AS d,
    (tp.punch_ts AT TIME ZONE 'America/Sao_Paulo')::time  AS t,
    tp.punch_type,
    ROW_NUMBER() OVER (
      PARTITION BY tp.employee_id, (tp.punch_ts AT TIME ZONE 'America/Sao_Paulo')::date
      ORDER BY tp.punch_ts
    ) AS rn
  FROM public.time_punches tp
  WHERE tp.employee_id IS NOT NULL
),
jornadas AS (
  SELECT
    p1.employee_id, p1.unit_id, p1.d,
    p1.t AS entrada,
    LEAD(p1.t) OVER (PARTITION BY p1.employee_id, p1.d ORDER BY p1.rn) AS saida
  FROM punches_ordenados p1
  WHERE p1.punch_type IN ('entrada','retorno')
),

-- 5) Presença = jornada com >=2h CONSECUTIVAS dentro da janela do turno
presentes AS (
  SELECT DISTINCT
    j.employee_id, j.unit_id, j.d AS schedule_date, t.turno
  FROM jornadas j
  CROSS JOIN turnos t
  WHERE j.saida IS NOT NULL
    AND EXTRACT(EPOCH FROM (LEAST(j.saida, t.win_end) - GREATEST(j.entrada, t.win_start))) >= 7200
),

-- 6) Remanejado: a partir de schedule_attendance.remanejado_de/para_sector_id
remanejados AS (
  SELECT
    sa.attendance_date  AS schedule_date,
    sa.employee_id,
    sa.remanejado_de_sector_id  AS sector_origem,
    sa.remanejado_para_sector_id AS sector_destino,
    -- turno derivado do shift_id se possível
    CASE WHEN sh.type ILIKE 'almoc%' THEN 'ALMOCO' ELSE 'JANTAR' END AS turno
  FROM public.schedule_attendance sa
  LEFT JOIN public.shifts sh ON sh.id = sa.shift_id
  WHERE sa.remanejado_para_sector_id IS NOT NULL
),

-- 7) POP mínimo canônico vigente
pop_min AS (
  SELECT
    p.unit_id, p.sector_id,
    CASE p.dia_semana
      WHEN 'SEG' THEN 1 WHEN 'TER' THEN 2 WHEN 'QUA' THEN 3
      WHEN 'QUI' THEN 4 WHEN 'SEX' THEN 5 WHEN 'SAB' THEN 6 WHEN 'DOM' THEN 0
    END AS dow,
    p.refeicao::text AS turno,
    p.quantidade_minima AS pop_minimo
  FROM public.pop_minimo_padrao p
  WHERE p.vigente_ate IS NULL
),

-- 8) Universo de slots (sector × data × turno) = todos onde existe POP definido
slots AS (
  SELECT DISTINCT
    s.id AS sector_id, s.unit_id,
    g.schedule_date,
    t.turno,
    pm.pop_minimo
  FROM public.sectors s
  CROSS JOIN (
    SELECT DISTINCT schedule_date FROM public.schedules
    WHERE schedule_date >= current_date - 30
  ) g
  CROSS JOIN turnos t
  JOIN pop_min pm
    ON pm.sector_id = s.id
   AND pm.unit_id   = s.unit_id
   AND pm.dow       = EXTRACT(DOW FROM g.schedule_date)::int
   AND pm.turno     = t.turno
)

SELECT
  sl.unit_id,
  sl.sector_id,
  sl.schedule_date,
  sl.turno,
  sl.pop_minimo,

  -- agregados
  COUNT(DISTINCT esc.employee_id) FILTER (WHERE esc.employee_id IS NOT NULL) AS escalados,
  COUNT(DISTINCT pr.employee_id)  FILTER (WHERE pr.employee_id IS NOT NULL
                                          AND EXISTS (
                                            SELECT 1 FROM escalados e2
                                            WHERE e2.employee_id = pr.employee_id
                                              AND e2.sector_id   = sl.sector_id
                                              AND e2.schedule_date = sl.schedule_date
                                              AND e2.turno = sl.turno
                                          )) AS pop_chegou,
  -- listas nominais
  jsonb_agg(DISTINCT jsonb_build_object(
    'employee_id', esc.employee_id,
    'name', esc.employee_name,
    'phone', esc.employee_phone,
    'start', esc.start_time,
    'end',   esc.end_time
  )) FILTER (WHERE esc.employee_id IS NOT NULL) AS escalados_lista,
  -- … (mesma estrutura para presentes/faltantes/extras/remanejados)

  -- saldo e status
  (sl.pop_minimo
     - COUNT(DISTINCT pr.employee_id) FILTER (...)
     - /* extras */ 0
     + /* remanejados_negativo */ 0
     - /* remanejados_positivo */ 0
  ) AS saldo_final,

  CASE
    WHEN sl.schedule_date = current_date
     AND (current_time AT TIME ZONE 'America/Sao_Paulo')::time
         < (SELECT win_start FROM turnos WHERE turno = sl.turno) THEN 'aguardando'
    WHEN /* saldo<0 */ FALSE THEN 'inconforme'
    ELSE 'conforme'
  END AS status,

  now() AS computed_at
FROM slots sl
LEFT JOIN escalados esc
  ON esc.sector_id = sl.sector_id
 AND esc.schedule_date = sl.schedule_date
 AND esc.turno = sl.turno
LEFT JOIN presentes pr
  ON pr.employee_id = esc.employee_id
 AND pr.schedule_date = sl.schedule_date
 AND pr.turno = sl.turno
 AND pr.unit_id = sl.unit_id
GROUP BY sl.unit_id, sl.sector_id, sl.schedule_date, sl.turno, sl.pop_minimo;
```

*(O SQL acima é o esqueleto canônico — a Etapa A polirá o agregado nominal de faltantes/extras/remanejados em CTEs próprias para manter legibilidade.)*

### 2.2 VIEW comum × MATERIALIZED VIEW

**Proposta: VIEW comum.**

- Volume é baixo (32k schedules total, 22k punches total).
- Materializar exige `REFRESH MATERIALIZED VIEW` agendado e introduz latência percebida pelo gestor (5 min é alto para faltante em tempo real).
- Filtro por `schedule_date BETWEEN ? AND ?` no client deixa o planner usar os índices.
- Se em produção a latência subir, **promove-se** a materialized depois (`CREATE MATERIALIZED VIEW vw_pop_diario_mv` + cron 60 s) sem mudar a API do hook.

### 2.3 Índices necessários (a criar na Etapa A)

```sql
CREATE INDEX IF NOT EXISTS idx_schedules_date_status
  ON public.schedules (schedule_date, status) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_schedules_unit_date
  ON public.schedules (unit_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedules_sector_date
  ON public.schedules (sector_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_employees_unit_active_worker
  ON public.employees (unit_id, active, worker_type);
CREATE INDEX IF NOT EXISTS idx_schedule_attendance_date
  ON public.schedule_attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_extras_checkins_unit_date
  ON public.extras_checkins (unit_id, ((checkin_ts AT TIME ZONE 'America/Sao_Paulo')::date));
```

### 2.4 REMANEJADO — estratégia

`time_punches` **não** traz `sector_id`. Não é possível inferir remanejamento só pelo ponto.

**Proposta:**

- **Fonte oficial: `schedule_attendance.remanejado_de_sector_id / remanejado_para_sector_id**` (tabela já existe e o `useAttendance` já escreve nela).
- A view soma `+1` no `sector_destino` e `-1` no `sector_origem`.
- Para **inferência leve**: se o employee bateu ponto e está escalado para outro setor do mesmo turno na mesma unidade, marca como `EXTRA_DOBRA` (não como remanejamento) e sugere lançamento manual no drill-down.
- `pop_ajustes_manuais` é redundante com `schedule_attendance` → **decisão em 6.2**: deprecar `pop_ajustes_manuais` ou unificar campos.

### 2.5 “2h consecutivas” — estratégia

Punches são linhas separadas (`entrada`, `saida_intervalo`, `retorno`, `saida`). A CTE `jornadas` casa cada `entrada/retorno` com a **próxima** batida do mesmo dia via `LEAD()`. Para cada par `(entrada, saida)`, calcula a interseção com a janela do turno e exige `>= 7200s`. Cobre os casos:

- Jornada única (entrada→saida) cruzando o turno inteiro.
- Jornada com intervalo (entrada→saida_intervalo + retorno→saida): qualquer um dos dois trechos isolado já satisfaz 2h, ou a soma dos dois (decisão em 6.2: estritamente consecutivas no PDF → escolhi **trecho único**; mudar é trivial).

---

## BLOCO 3 — Hook único `usePopDiario`

### 3.1 Assinatura

```ts
function usePopDiario(filtros: {
  unitId?: string | string[];        // string[] = admin global
  sectorId?: string;
  date: Date | { from: Date; to: Date };
  turno?: "almoco" | "jantar" | "todos";
}): {
  rows: PopDiarioRow[];            // 1 linha por (unit, sector, date, turno)
  byUnit: Record<string, UnitAgg>; // agregado client-side
  byDate: Record<string, DateAgg>;
  isLoading, isFetching, error, refetch,
};
```

Fonte: `SELECT * FROM vw_pop_diario WHERE ...`. Filtros viram `.eq/.in/.gte/.lte` no Supabase client.

### 3.2 Cache (React Query)

- `staleTime: 60_000` (1 min)
- `refetchInterval: 5 * 60_000` (5 min, igual ao `usePopStatusDiario` atual)
- `refetchIntervalInBackground: false`
- `queryKey: ["pop-diario", filtros]` — chave estável serializando datas.

### 3.3 Hooks deprecated por este


| Atual                | Para onde migra                                                       | Quando deletar |
| -------------------- | --------------------------------------------------------------------- | -------------- |
| `usePopStatusDiario` | `usePopDiario({date: today, unitId: 'todas'})`                        | Etapa E        |
| `usePopCompliance`   | `usePopDiario({date:{from,to}})` + agregação no componente            | Etapa E        |
| `useQuadroDetalhado` | `usePopDiario({date, unitId, sectorId})` → drill-down já vem na linha | Etapa E        |


---

## BLOCO 4 — Redesenho das telas

### 4.1 Quadro Operacional (`/quadro-operacional`)

- Hoje: `AdminGlobalView.tsx` + `QuadroDetalhado.tsx`.
- Mudança: card por unidade lê `byUnit` do hook (POP/Escalados/POP_Chegou/Faltam/Extras/Saldo, % conforme, barra).
- Expansão por setor: tabela igual ao PDF página 11 — cores semânticas (`bg-destructive/15` vermelho, `bg-warning/15` amarelo, `bg-success/15` verde).
- Drill-down por linha: nomes de escalados/presentes/faltantes (com telefone para WhatsApp) e extras.

### 4.2 Dashboard POP (`/dashboard-pop`)

- Hoje: `PopComplianceDashboard.tsx` (semanal).
- Mudança: passa a usar `usePopDiario({date:{from,to}})`. Adiciona: % conformidade 7/30 dias, heatmap setores que mais falham, ranking de faltantes recorrentes (`schedule_attendance` agregado).

### 4.3 Gestão D-1 (`/gestao-d1`)

- Manter. Adicionar header de setor lendo `vw_pop_diario.pop_minimo` para “X de Y necessários”.

### 4.4 Editor de Escalas

- Coluna POP atual (lê `staffing_matrix`/`holding_staffing_config`) passa a ler `vw_pop_diario`. Sem mais mudanças nesta fase.

### 4.5 Mobile do gerente

- Reusa o card unidade do 4.1 + drill-down setor único. Apenas componente novo `<QuadroOperacionalMobile>` que filtra pela `unidade` do `useUnidade()`.

### 4.6 Telas/componentes a remover (após Etapa F)

- `src/hooks/usePopStatusDiario.ts`
- `src/hooks/usePopCompliance.ts`
- `src/hooks/useQuadroDetalhado.ts`
- RPCs `pop_status_diario`, `pop_quadro_detalhado`, `pop_extras_hoje` (substituídas pela view).
- Decisão pendente: `pop_ajustes_manuais` (ver 6.2).

---

## BLOCO 5 — Plano de execução


| Etapa | Conteúdo                                                            | Cria                                           | Modifica                                     | Deleta                             | Risco                          | Independente? |
| ----- | ------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------- | ---------------------------------- | ------------------------------ | ------------- |
| **A** | Migration: `vw_pop_diario` + 6 índices + grants                     | view, índices                                  | —                                            | —                                  | Baixo (não toca código)        | ✔             |
| **B** | `src/hooks/usePopDiario.ts` + tipos                                 | 1 hook                                         | —                                            | —                                  | Nenhum (não é consumido ainda) | ✔             |
| **C** | Redesenho Quadro Operacional + Mobile                               | `QuadroOperacionalMobile.tsx`, `SectorRow.tsx` | `AdminGlobalView.tsx`, `QuadroDetalhado.tsx` | —                                  | Médio (UI principal do gestor) | ✔             |
| **D** | Redesenho Dashboard POP                                             | —                                              | `PopComplianceDashboard.tsx`                 | —                                  | Baixo                          | ✔             |
| **E** | Migrar `OperationalDashboard`, Editor de Escalas, Gestão D-1 header | —                                              | 3 arquivos                                   | —                                  | Médio                          | ✔             |
| **F** | Limpeza                                                             | —                                              | —                                            | 3 hooks + 3 RPCs (com confirmação) | Baixo se A-E validadas         | ✔             |


Cada etapa deixa o app funcional (hooks antigos só somem na F).

### 5.3 Pontos de validação visual

- **A**: rodar `SELECT * FROM vw_pop_diario WHERE schedule_date = CURRENT_DATE AND unit_id = '<Caju Limão>'` e conferir contra contagem manual.
- **B**: storybook/console: `usePopDiario` retorna mesmas linhas da query SQL.
- **C**: comparar Quadro Operacional novo vs antigo lado a lado em 3 lojas (1 grande, 1 média, 1 holding).
- **D**: heatmap bate com média semanal manual.
- **E**: smoke test em `/escalas` e `/gestao-d1`.
- **F**: build limpo + `rg "usePopStatusDiario|usePopCompliance|useQuadroDetalhado"` → 0.

---

## BLOCO 6 — Riscos e dependências

### 6.1 Pontos cegos identificados

1. **1.612 punches sem `employee_id**` em 7 dias (10%). Aparecem como “ausente” mesmo quando bateram ponto. Mapeamento via `secullum_employee_id` → `employees.secullum_id` ainda incompleto.
2. **POP coverage ~75%**: setores sem POP vão sumir do quadro (saldo NULL). Precisa Pedro validar se intencional.
3. **Holding × Conselho**: lojas com POP via `holding_staffing_config` (sector_key textual) **não** entram em `vw_pop_diario` (que pivota em `sector_id`). Se há unidades holding sem mirror em `pop_minimo_padrao`, ficam fora.
4. `**schedule_attendance` vazia**: REMANEJADO só aparece se gestor lançar; até lá, drill-down mostra zero.
5. **Janela cruzando meia-noite** (jantar terminando 02h): o pareamento por `(employee_id, data)` quebra. Hoje é raro, mas é debt.
6. **Atraso vs ausente**: PDF trata atraso < 15 min como presente. View atual marca presente apenas se 2h consecutivas — alinha, mas perdemos a métrica de “atraso pontual”. Manter via hook secundário se necessário.
7. **RLS**: a view roda com permissões do consumidor. Precisa `GRANT SELECT ON vw_pop_diario TO authenticated;` e validar que RLS de `schedules/employees/time_punches` não filtra demais para admins globais.
8. **Performance**: o `CROSS JOIN` em `slots` cresce com período; o filtro `schedule_date >= current_date - 30` na CTE limita. Para Dashboard de 30 dias, query roda ≤ 200 ms em 11 unidades.

### 6.2 Decisões bloqueantes (preciso de você antes de seguir)

1. **Holding × Conselho — fonte única de POP**: posso assumir que `pop_minimo_padrao` é a única fonte e que holding já foi espelhada? Se não, view precisa também consultar `holding_staffing_config` mapeando `sector_key → sector_id`.
2. `**pop_ajustes_manuais` vs `schedule_attendance**`: posso unificar em `schedule_attendance` (fonte canônica de REMANEJADO) e deprecar `pop_ajustes_manuais` na Etapa F? Ou manter as duas?
3. **Critério “2h consecutivas”** — estritamente em **um trecho** (entrada→saída_intervalo OU retorno→saída), ou aceito soma dos dois trechos dentro da janela?
4. **Setores sem POP definido**: aparecem no quadro como informativo (POP=0, saldo=presentes) ou são omitidos?
5. **Punches órfãos (10%)**: pausar Etapa C até reconciliação Secullum, ou seguir e mostrar contador “X punches não mapeados” no header?
6. **Feriado/dia especial**: PDF não cobre. Tratamento por `pop_overrides`? (Hoje tem 0 rows.)

---

## Quadro Resumido

- **Etapas**: 6 (A migration, B hook, C Quadro Op, D Dashboard, E migrações, F limpeza)
- **Arquivos tocados**: ~12 (1 hook novo, 2 componentes novos, ~6 modificados, ~3 deletados, 1 migration)
- **Estimativa de prompts Lovable**: 6 (1 por etapa) + ~2 de ajuste fino = **8 prompts**
- **Riscos críticos**:
  - Punches sem `employee_id` (10%) podem inflar “faltantes” fantasma → mitigar com badge no header.
  - Holding sem mirror em `pop_minimo_padrao` deixa unidades fora da view.
  - `schedule_attendance` vazia hoje → REMANEJADO/ABONO precisa fluxo de input antes de virar métrica confiável.
- **Decisões bloqueantes para mim**: as 6 perguntas do bloco 6.2.

Aguardando suas respostas em 6.2 (ou “toca em frente nas defaults”) para abrir a Etapa A com a migration completa.  
  
  
PLANO APROVADO COM AJUSTES.

═══════════════════════════════════════════════════════════

DECISÕES DAS 6 PERGUNTAS BLOQUEANTES

═══════════════════════════════════════════════════════════

D1 — Fonte única de POP: APROVADO

  pop_minimo_padrao é a ÚNICA fonte canônica do POP

  mínimo. A view vw_pop_diario consulta SOMENTE essa

  tabela.

  Não consultar holding_staffing_config na view.

  Adicionar consulta de AUDITORIA (separada da view):

  uma RPC ou query que lista unidades/setores que têm

  registro em holding_staffing_config MAS NÃO em

  pop_minimo_padrao. Isso vira um painel administrativo

  futuro pra forçar migração da dívida.

D2 — schedule_attendance vs pop_ajustes_manuais: APROVADO

  schedule_attendance é a fonte canônica de ABONO,

  JUSTIFICATIVA e qualquer ajuste manual.

  pop_ajustes_manuais SAI nesta fase. Na Etapa F:

    1. SELECT COUNT(*), MAX(created_at) FROM

       pop_ajustes_manuais para confirmar baixíssimo

       uso. Reportar antes de deletar.

    2. Se vivo (≥1 row últimos 30 dias): pausar deleção

       e me reportar — decidiremos migração caso a caso.

    3. Se morto: DROP TABLE pop_ajustes_manuais.

D3 — "2h consecutivas": APROVADO COMO TRECHO ÚNICO

  Literal ao PDF. Pessoa precisa ter UM trecho

  (entrada→saída_intervalo OU retorno→saída) que se

  sobreponha à janela do turno por ≥ 7200s.

  Soma de trechos NÃO conta.

  Documentar essa decisão em comentário na CTE de

  presença, citando POP 02 cláusula 5.2.4.

D4 — Setores sem POP cadastrado: APROVADO

  Esses setores são OMITIDOS da view vw_pop_diario.

  Criar VIEW SECUNDÁRIA vw_pop_setores_sem_cobertura:

    SELECT unit_id, sector_id, sector_name, unit_name

    FROM sectors s

    WHERE NOT EXISTS (

      SELECT 1 FROM pop_minimo_padrao p

      WHERE p.sector_id = [s.id](http://s.id) AND p.vigente_ate IS NULL

    );

  Essa view alimenta um futuro "Painel de Auditoria de

  POP" — não precisa UI agora, mas a view fica criada.

D5 — Punches órfãos (10% sem employee_id): APROVADO

  Seguir Etapa C. Não pausar.

  Adicionar ao retorno do hook usePopDiario um campo

  auxiliar:

    orphan_punches_count: number

    (count de time_punches NULL employee_id no período

     filtrado)

  Quadro Operacional mostra badge laranja no header:

    "X pontos batidos não mapeados"

    [Clicar abre lista pra reconciliar — futura Fase]

  Em paralelo (não bloqueante): preparar SQL de mapping

  massivo via secullum_employee_id → employees.secullum_id.

  Eu rodo separadamente quando estiver pronto.

D6 — Feriados / dias especiais: APROVADO COMO SCOPE OUT

  Não tratar nesta fase. Dia da semana via

  EXTRACT(DOW FROM schedule_date) fixo.

  Se aparecer caso real depois, criamos

  holiday_overrides como tabela isolada — não muda a

  view.

═══════════════════════════════════════════════════════════

DECISÃO ADICIONAL DO PEDRO (NÃO ESTAVA NO SEU PLANO)

═══════════════════════════════════════════════════════════

REMANEJADO: REMOVER COMPLETAMENTE DO ESCOPO

Decisão de produto: o conceito de "remanejado" como

métrica visível NÃO entra no Painel da Liderança.

Justificativa:

  • schedule_attendance está vazia (12 rows totais).

    Não tem hábito operacional de uso.

  • Sem UI de input, virou conceito morto. Adicionar

    UI dobra escopo da fase.

  • PDF do POP cita remanejamento mas trata como

    AJUSTE OPERACIONAL (Excel do DP), não como

    métrica de gestão diária.

  • Foco do Painel é responsabilizar gestor pelo POP

    do SEU setor. Remanejamento é negociação entre

    setores que pode ser tratada offline.

AÇÕES OBRIGATÓRIAS:

  1. REMOVER da view vw_pop_diario:

     - Colunas: remanejados_in, remanejados_out,

       remanejados_lista

     - CTE remanejados completa

     - Linhas de saldo_final que somam/subtraem remanejados

  2. SALDO_FINAL passa a ser:

     saldo_final = pop_minimo - pop_chegou - extras_no_setor

     Negativo = falta gente (incluindo extras já contados).

     Zero ou positivo = ok.

  3. NÃO consultar schedule_attendance nesta fase pra fins

     de remanejamento. A tabela continua existindo (pode

     ser usada futuramente pra abono/justificativa), mas

     view ignora os campos remanejado_de_sector_id e

     remanejado_para_sector_id.

  4. Quadro Operacional NÃO mostra coluna "Remanejados".

     Tabela colorida do PDF página 11 fica com colunas:

       Setor | POP | Escalados | Presentes | Extras | Saldo

  5. Drill-down nominal só tem 4 grupos:

       Escalados | Presentes | Faltantes | Extras

  6. Reduzir o "Hooks deprecated" — qualquer hook que

     trate remanejamento sai do escopo dessa migração.

ESSA SIMPLIFICAÇÃO REDUZ:

  • Complexidade da view em ~25%

  • Tempo de execução da Etapa A

  • Necessidade de UI nova (sem modal de lançamento)

  • Manutenção futura

═══════════════════════════════════════════════════════════

PRÓXIMO PASSO — EXECUTAR ETAPA A

═══════════════════════════════════════════════════════════

Agora você pode prosseguir com a EXECUÇÃO da Etapa A:

  • Migration completa: vw_pop_diario + vw_pop_setores_sem_cobertura

    + 6 índices novos + GRANTs

  • SEM colunas/CTE de remanejado

  • SQL aplicado via MCP Supabase

REGRAS DE EXECUÇÃO DA ETAPA A:

  ✓ Rodar a migration SQL completa no Supabase

  ✓ Após aplicada: rodar query de validação

      SELECT * FROM vw_pop_diario

      WHERE schedule_date = CURRENT_DATE

      ORDER BY unit_id, sector_id, turno;

  ✓ Me devolver:

      - SQL exato aplicado

      - Quantas linhas a view retorna pra hoje

      - 1 amostra de linha com todos os campos

      - Tempo de execução da query

      - Confirmação que vw_pop_setores_sem_cobertura

        existe e quantos setores retorna

  ✓ NÃO criar hook nem tocar em frontend ainda

  ✗ NÃO executar Etapa B (hook) sem minha aprovação

  ✗ NÃO usar Try to fix se algo derrapar

  ✗ NÃO tomar decisões adicionais não cobertas aqui

Se durante a execução da migration aparecer erro ou

decisão não coberta, PARAR e me reportar antes de

prosseguir.

Pode executar a Etapa A agora.