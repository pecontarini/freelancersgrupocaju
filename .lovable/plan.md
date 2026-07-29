## Objetivo
Permitir lançar turnos que viram a noite (ex.: 22:00 → 06:00) no editor de escalas, com indicação visual clara no modal e na grade.

## Diagnóstico
O salvamento já aceita turnos virados: `useUpsertSchedule` não compara horários, não há constraint de horário no banco e `calculateHours` no modal já soma 24h quando o fim é menor que o início.

O que atrapalha é o comportamento do botão **"Manter duração"** (`linkDuration`) em `src/components/escalas/ScheduleEditModal.tsx`, ligado por padrão: ao digitar o horário de fim (06:00), o campo de início é reescrito automaticamente para manter a duração anterior — o usuário não consegue fixar 22:00 → 06:00 sem antes desativar o vínculo.

## Mudanças

1. **Modal de edição do turno** (`ScheduleEditModal.tsx`)
   - Desligar o vínculo de duração automaticamente quando o usuário editar diretamente o campo de fim: o valor digitado é respeitado e o início não é mais reescrito. (Alternativa que também será aplicada: ao detectar turno virado, o vínculo é desativado e o botão passa a exibir "Editar início e fim independentes".)
   - Exibir, abaixo dos campos de horário, um aviso discreto quando `fim < início`: "Turno vira o dia — termina no dia seguinte", com o total de horas já calculado corretamente (ex.: 22:00 → 06:00 = 8h).
   - Marcar o campo Fim com o sufixo "+1d" no rótulo quando o turno virar o dia.

2. **Grade de escalas** (`ManualScheduleGrid.tsx`)
   - Na célula do turno, acrescentar o marcador "+1d" ao intervalo exibido quando o fim for menor que o início (ex.: `22:00–06:00 +1d`), para os gerentes lerem corretamente. O cálculo de horas na célula já trata a virada de dia.

3. Sem alterações em exports (PDF/Excel) e no resumo semanal, conforme definido.

## Detalhes técnicos
Sem migração de banco: `start_time`/`end_time` são do tipo `time` e aceitam qualquer par. Alteração restrita a frontend/apresentação, sem mudança nas regras de aprovação, compliance CLT ou cálculo de custo.
