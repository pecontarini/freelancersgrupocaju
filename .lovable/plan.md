## Problema

No `GeradorEscalaIA.tsx`, ao montar as `DraftSlot.days`, qualquer dia em que **não existe um slot daquela vaga (instância `i`)** é marcado como `off`. Resultado: vagas que só aparecem em alguns dias do quadro POP viram linhas com **muitas folgas** no Editor, em vez de horários trabalháveis com 1 folga.

Exemplo: vaga "Garçom" com 3 instâncias na sex/sáb mas só 2 em ter/qua/qui — a 3ª linha-vaga fica como folga em todos os dias úteis e só "trabalha" sex/sáb. Errado.

## Comportamento desejado

Cada linha-vaga enviada para o Editor deve:

1. Vir **preenchida em todos os 7 dias** com um horário padrão coerente (T1/T2/T3) do tipo de vaga.
2. Ter **off apenas nos dias listados em `dias_folga_sugeridos`** vindos da IA (1 folga típica).
3. Operador então só ajusta a folga real e vincula a uma pessoa.

## Mudanças (somente `src/components/escalas/GeradorEscalaIA.tsx`)

Reescrever o bloco de montagem dos `days` (linhas ~246–295):

1. **Derivar um horário-padrão por grupo** (`tipo + responsavel`):
   - Varrer todos os dias do quadro e coletar todos os `slot.t1` / `slot.t2` daquele grupo.
   - Escolher o turno **mais frequente** (moda) — se houver T1 e T2 num mesmo slot, contar como T3 (`t1.entrada → t2.saida`, `break_min`).
   - Esse vira o `defaultDay` (kind: "work").

2. **Preencher todos os 7 dias com o `defaultDay`**:
   - Se existir um slot específico para o dia/instância, usar o horário desse slot (preserva variações reais por dia).
   - Caso contrário, usar o `defaultDay` (em vez de marcar `off`).

3. **Aplicar folgas só onde a IA pediu**:
   - Após preencher, sobrescrever com `{ kind: "off" }` apenas os dias presentes em `resultado.dias_folga_sugeridos`.
   - Se a IA não sugeriu folga alguma para a vaga, deixar todos working — operador marca depois.

4. **Fallback de segurança**: se o grupo não tiver nenhum `t1`/`t2` em nenhum dia (raro), pular o grupo (não criar drafts vazios) em vez de gerar 7 folgas.

Nada muda no `useAIDraftSlots`, no `ManualScheduleGrid` (já permite togglear off↔work clicando), no agrupamento por `(tipo, responsavel, maxQty)` nem na navegação para o Editor.

## Validação

- Rodar geração IA com setor que tenha quadro variável por dia → conferir que cada linha-vaga aparece com horário em 6 dias e 1 folga (a sugerida), não 4 folgas.
- Conferir que clicar numa célula da linha-vaga continua alternando off ↔ work com o horário padrão.
- Conferir que vincular a um funcionário persiste os 6 dias de trabalho + 1 folga corretamente.