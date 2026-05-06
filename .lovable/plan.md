## Regra final (turno único)

```
start_time  = entrada sugerida pela IA
end_time    = saída sugerida pela IA   (a que o slot trouxe em t.saida)
break_min   = 180  (3h fixo, sempre)
```

Sem cap de 13h, sem usar `fechamento`, sem `entrada + efetivo + 3h`. Slots em dobra (T1+T2) continuam como já estão: `start = T1.entrada`, `end = T2.saida`, `break = 180`.

## Mudança no código (`src/components/escalas/GeradorEscalaIA.tsx`)

Reverter `slotToDay` para usar `t.saida` diretamente. Remover o parâmetro `fechamento` (não é mais usado). Manter `break_min = 180` em ambos os ramos.

```ts
const slotToDay = (slot: SlotResponse): DraftDay | null => {
  if (slot.t1 && slot.t2) {
    return { kind: "work", start_time: slot.t1.entrada,
             end_time: slot.t2.saida, break_min: 180, shift_type: "T3" };
  }
  const t = slot.t1 ?? slot.t2;
  if (!t) return null;
  return { kind: "work", start_time: t.entrada, end_time: t.saida,
           break_min: 180, shift_type: slot.t1 ? "T1" : "T2" };
};
```

E remover o argumento `fechamento` das chamadas a `slotToDay(...)`.

## Atualização em massa — limitação importante

O payload original da IA **não fica salvo** em nenhuma tabela. As migrações anteriores sobrescreveram `end_time` em `ai_draft_slots` e `schedules` da semana corrente, então a "saída sugerida pela IA" original foi perdida no banco.

Hoje todos os turnos únicos da semana 2026-05-04 estão com `end_time` igual ao fechamento da loja (00:30 / 02:30 / 23:30). Não há como reconstruir deterministicamente a saída original que a IA havia proposto sem rodar o gerador de novo.

**Caminho recomendado** (executável agora, sem perda):
1. Corrigir o código de `slotToDay` (acima).
2. No editor de escalas, abrir a semana corrente, clicar em **Gerador IA** novamente para o setor afetado, aplicar a proposta e salvar. O novo payload virá com a regra correta (`start = entrada IA`, `end = saída IA`, `break = 180`).
3. Não rodar nova migração SQL em massa — qualquer heurística (entrada+10h, entrada+13h, fechamento) reintroduz o mesmo problema que estamos corrigindo.

Se mesmo assim você quiser uma migração SQL determinística para a semana atual, preciso que confirme **uma** regra fechada (ex: `end = start + 10h` para todo turno único). Caso contrário, re-rodar o Gerador IA é o único caminho que respeita a saída original sugerida pela IA.

## Arquivos

```
src/components/escalas/GeradorEscalaIA.tsx   # slotToDay sem fechamento, sem cap
```
