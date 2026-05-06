## Ajuste

A jornada do turno único deve ir da **entrada até o fechamento da loja no dia**, com 3h de intervalo embutidas — não `entrada + efetivo + 3h`.

Exemplo: `EXTRA-ALMOCO 11:00` num dia tipo C (fecha 02:30) vira `11:00 → 02:30` com `break_min = 180`. Num domingo (fecha 23:30), vira `11:00 → 23:30`. Numa segunda (fecha 00:30), vira `11:00 → 00:30`.

## Mudança no gerador (`GeradorEscalaIA.tsx`)

Em `slotToDay()`, para slots de turno único, ler `dia.fechamento` do payload da IA (já existe: `"00:30" | "02:30" | "23:30"`) e usar como `end_time`. `break_min = 180` sempre. Slots em dobra (T1+T2) seguem como `start = T1.entrada → end = T2.saida` (já é o fechamento).

Para isso, `slotToDay` precisará receber o `fechamento` do dia como parâmetro adicional.

## Atualização em massa (semana corrente)

Reescrever novamente `ai_draft_slots` e `schedules` da semana atual, agora estendendo ao fechamento. Como o payload da IA não está acessível dentro de uma SQL pura, usar a seguinte heurística por **dia da semana** (padrão Caju Limão Itaim, idêntico para todas as unidades do grupo segundo o POP atual):

```text
SEG, TER, QUA → fecha 00:30 (dia seguinte)
QUI, SEX, SAB → fecha 02:30 (dia seguinte)
DOM           → fecha 23:30 (mesmo dia)
```

Regra do UPDATE:
- Apenas linhas com `kind = 'work'` em `ai_draft_slots` e `schedule_type='working'` / `status<>'cancelled'` em `schedules`.
- Apenas turnos únicos (duração bruta atual < 11h, identificando que ainda não foi expandido).
- `end_time = fechamento do dia da semana`.
- `break_min` / `break_duration = 180`.

Sem mexer em semanas passadas.

## Arquivos

```text
src/components/escalas/GeradorEscalaIA.tsx    # passar `fechamento` para slotToDay
+ migration SQL (UPDATE ai_draft_slots + schedules da semana corrente)
```