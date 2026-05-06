
## Contexto

Hoje, quando o Gerador de IA produz um turno com T1 + T2 (jornada partida), o sistema envia para o Editor de Escalas um único horário "achatado" (`T1.entrada → T2.saida`) usando o `break_min` que vem do JSON da IA. Resultado: o intervalo nem sempre reflete o tempo real entre o fim do T1 e o começo do T2, e o operador não consegue interpretar a jornada da mesma forma que vê no Gerador.

Além disso, o fluxo "ver e usar a escala" hoje só funciona se o operador souber que precisa abrir manualmente a aba **Editor de Escalas** depois de gerar — não há um caminho guiado nem indicação visual de que há vagas pendentes.

## Parte 1 — Horários T1/T2 com intervalo real

### Comportamento atual
`slotToDay()` em `GeradorEscalaIA.tsx` (linhas 253-272) usa:
```
start_time = T1.entrada
end_time   = T2.saida
break_min  = slot.break_min ?? 0   ← vem cru da IA
```

### Comportamento desejado
- Quando o slot tem **T1 + T2**: o intervalo deve ser **calculado** como `T2.entrada − T1.saida` (em minutos), não confiar no `break_min` solto.
- Quando o slot tem **apenas T1** ou **apenas T2**: continuar como hoje (sem intervalo, ou só o `break_min` se vier).
- A célula no grid já mostra `HH:MM - HH:MM` + ícone de café se houver intervalo. Vamos reforçar: ao passar o mouse na célula de uma vaga IA com jornada partida, o tooltip mostra `T1 07:00–11:00 • Intervalo 2h00 • T2 13:00–17:00`.

### Onde mexe
- `src/components/escalas/GeradorEscalaIA.tsx` — função `slotToDay`: calcular `break_min` a partir dos horários reais de T1/T2.
- `src/components/escalas/ManualScheduleGrid.tsx` — `ScheduleCell` (linhas 2291-2367) e a renderização da linha de draft (linhas 1733-1775): adicionar `title` no `<TableCell>` formatando T1/intervalo/T2 quando o slot for de jornada partida (`shift_type === "T3"` e `break_duration > 0`).

Nada muda na persistência: ao vincular a um funcionário, já gravamos `start_time`, `end_time` e `break_duration` corretos.

## Parte 2 — Fluxo de "ver e usar" a escala IA

### Princípios
- O operador termina a geração e **não precisa procurar nada** — o sistema o leva para o Editor de Escalas com as vagas já visíveis.
- A vaga aberta tem affordance clara: como vincular, como marcar folga, como descartar.
- Não há persistência fantasma: se o operador sair sem vincular, as vagas somem (já é o comportamento atual via `useAIDraftSlots` em memória) — mas avisamos antes.

### Mudanças propostas

**A. Banner de aterrissagem no Editor.** Quando há `draftSlots` na semana/setor atual, mostrar no topo do `ManualScheduleGrid` um banner discreto (estilo liquid glass, accent coral):
> "N vagas geradas pela IA aguardando vínculo. Clique em **Vincular** em cada linha para atribuir a um funcionário, ou **Descartar tudo**."
- Botão **Descartar tudo** chama `clearDraftSlotsFor(unit, sector, week)`.
- O banner some sozinho quando não restam drafts.

**B. Auto-scroll e highlight.** Ao receber o evento `ai-drafts-ready`, além de trocar de aba/setor (já feito), rolar a tabela até a primeira linha de draft e dar um pulse visual de 1.5s nas linhas novas (anel coral fade-out). Sem isso, em listas longas o operador não percebe que algo apareceu.

**C. CTA explícito no Gerador.** O botão "Enviar para o Editor de Escalas" continua, mas:
- Após sucesso, mostrar um toast com ação **"Abrir Editor agora"** que dispara o mesmo evento `ai-drafts-ready` (caso o operador tenha clicado em outra aba enquanto carregava).
- Adicionar texto curto abaixo do botão: *"As vagas vão aparecer como linhas 'Vaga Aberta' no Editor. Vincule cada uma a uma pessoa ativa para gravar a escala."*

**D. Aviso ao trocar de semana/setor com drafts pendentes.** Se houver drafts na semana atual e o operador tentar mudar `week` ou `sector`, mostrar um `AlertDialog`: "Existem N vagas IA não vinculadas. Manter na memória, descartar, ou continuar editando?". Hoje elas continuam na memória mas ficam invisíveis — confunde.

**E. Vincular em lote (opcional, simples).** No banner do item A, adicionar um botão **"Auto-vincular sugestões"** que abre um modal listando cada vaga lado-a-lado com a primeira pessoa ativa do mesmo `job_title` que ainda não tem escala completa na semana. Operador confere, marca o que aceita, confirma. Mantém o modelo "só persiste ao vincular".

### Onde mexe
- `src/components/escalas/ManualScheduleGrid.tsx` — adicionar banner, ref+scroll para a primeira linha draft, classe de highlight com `useEffect` baseado em `draftSlots.length`, AlertDialog em `setSelectedSectorId`/`setCurrentWeekBase` (apenas quando há drafts).
- `src/components/escalas/GeradorEscalaIA.tsx` — toast com ação "Abrir Editor agora" e legenda explicativa.
- (Item E, se aprovado) — novo componente `AIDraftBulkLinkModal.tsx`.

## Resumo do que será entregue

1. Intervalo correto T1/T2 nas vagas geradas pela IA (cálculo a partir dos horários reais).
2. Tooltip detalhado nas células de jornada partida.
3. Banner de "N vagas pendentes" + botão descartar tudo.
4. Auto-scroll + pulse na chegada das vagas.
5. Toast de sucesso com ação "Abrir Editor agora" + legenda.
6. Aviso ao mudar semana/setor com drafts pendentes.
7. (Opcional) Modal de auto-vínculo em lote.

## Pergunta antes de implementar

Quer incluir o item **E (auto-vincular em lote)** já agora, ou começamos só com A–D + a parte do intervalo, e o E fica para depois?
