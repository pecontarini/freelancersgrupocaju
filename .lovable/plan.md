## Problema

Hoje, slots de turno único (ex: `EXTRA-ALMOCO 11:00–15:00`, `EXTRA-JANTAR 17:00–21:00`, `TIPO-ALMOCO 10:30–16:00`) são gravados com `start_time`/`end_time` cobrindo **apenas o pico de trabalho**, sem incluir o intervalo de 3h. Resultado: quem olha a grade vê "11:00–15:00" e interpreta como **entrada→saída**, quando na verdade aquilo era só o bloco de pico que a IA assumiu.

Você quer que **a entrada e a saída exibidas sejam a jornada bruta real do funcionário**, com as 3h de intervalo já embutidas dentro desse intervalo.

## Mudança de critério (IA)

No `GeradorEscalaIA.tsx`, na função `slotToDay()`, mudar a regra para slots de turno único (`t1` OU `t2`, mas não ambos):

- **Hoje:** `start_time = t.entrada`, `end_time = t.saida`, `break_min = slot.break_min ?? 0`
- **Novo:** `start_time = t.entrada`, `break_min = 180`, `end_time = t.entrada + jornada_efetiva + 180min`, onde `jornada_efetiva = max(t.efetivo_min, diff(t.entrada, t.saida))`. Cap pelo fechamento do dia (00:30 / 02:30 / 23:30 conforme `tipo_dia`).

Slots em dobra (T1+T2) **continuam como estão** — já são gravados como `start = T1.entrada`, `end = T2.saida`, com `break_min` real entre os dois. Apenas garantir `break_min = 180` (forçar padrão).

## Atualização em massa (semana corrente)

Migration única que reescreve, **somente para a semana corrente** (`week_start = monday(today)` para `ai_draft_slots`; `schedule_date BETWEEN segunda E domingo` para `schedules`):

### `ai_draft_slots` (rascunhos da IA)
Para cada entrada `days[YYYY-MM-DD]` com `kind='work'`:
- Se `end_time - start_time < 11h` (não está em formato dobra) → recalcular: `end_time = start_time + (end_time - start_time) + 3h`, com cap no fechamento da unidade (default 02:30).
- `break_min = 180` em todos os casos.

### `schedules` (escalas confirmadas/manuais da semana atual)
- `status != 'cancelled'`, `schedule_type = 'working'`
- Se `(end_time - start_time) < interval '11 hours'` → `end_time = start_time + (end_time - start_time) + interval '3 hours'`, cap em 02:30 do dia seguinte.
- `break_duration = 180` sempre.

Nada nas semanas passadas; histórico fica intacto.

## Arquivos

```text
src/components/escalas/GeradorEscalaIA.tsx        # nova lógica de end_time + break
supabase migration (UPDATE em ai_draft_slots e schedules da semana atual)
```

## Saída esperada

- A grade passa a mostrar, p.ex., `11:00–18:00 (3h intervalo)` em vez de `11:00–15:00`.
- O cálculo de horas efetivas continua correto (jornada bruta − break).
- Próximas gerações da IA já saem nesse formato.
- Botão de revert não é necessário porque a operação é idempotente (rodar duas vezes não muda nada — já estará ≥11h).