## Plano: corrigir motivo de ausência ("Banco de Horas" e outros) no PDF/Excel da Escala

### Diagnóstico (confirmado no código + banco)

O enum `schedule_type` no banco aceita **5 valores**:
```
working | off | vacation | sick_leave | banco_horas
```

A grid (`ManualScheduleGrid.tsx`) e o modal de edição (`ScheduleEditModal.tsx`) tratam todos os 5, mas os dois exportadores **só conhecem 4**:

| Arquivo | Função | O que falta |
|---|---|---|
| `src/lib/scheduleMasterPdf.ts` linha 25-36 (`getCellText`) | Mapeia tipos → texto | Não trata `banco_horas` → cai no fallback `"Turno"` (start/end vazios) ou exibe horários antigos zerados |
| `src/lib/scheduleMasterExport.ts` linha 252-266 (`getCellValue`) | Mesmo bug | Idem — exporta célula vazia/"Turno" em vez de "BANCO DE HORAS" |

Quando o usuário marca "Banco de Horas" no modal, `start_time` e `end_time` ficam `NULL` na tabela, então no PDF aparece a string genérica "Turno" (ou string vazia no Excel) — exatamente o sintoma reportado.

Além disso, o styling condicional do PDF (linhas 232-246) só pinta células cujo texto seja exatamente `"FOLGA"`, `"FÉRIAS"` ou `"ATESTADO"` — vou estender para `"BANCO DE HORAS"` com cor própria (azul, igual a grid).

### O que vou implementar

#### 1. `src/lib/scheduleMasterPdf.ts`
- Adicionar em `getCellText`:
  ```ts
  if (entry.schedule_type === "banco_horas") return { text: "BANCO DE HORAS", type: "banco_horas" };
  ```
- Adicionar bloco de styling em `didParseCell` para `"BANCO DE HORAS"`:
  - fundo azul claro `[219, 234, 254]`
  - texto azul escuro `[29, 78, 216]`
  - bold

#### 2. `src/lib/scheduleMasterExport.ts`
- Estender o tipo de retorno de `getCellValue` para incluir `"banco_horas"`:
  ```ts
  if (entry.schedule_type === "banco_horas") return { text: "BANCO DE HORAS", type: "banco_horas" };
  ```
- Criar novo estilo `STYLE.bancoHoras` com fundo azul claro (`DBEAFE`) e texto azul escuro (`1D4ED8`).
- Ajustar `getCellStyle` para retornar `STYLE.bancoHoras` quando `type === "banco_horas"`.

#### 3. Defesa em profundidade — fallback para schedule_type desconhecido
Hoje, se um dia surgir um tipo novo no enum (ex: `licenca`, `suspensao`), os dois exportadores caem no fallback genérico "Turno"/vazio. Vou ajustar para que, quando `schedule_type !== 'working'` mas o tipo não for nenhum dos 4 mapeados, o texto seja `schedule_type.toUpperCase().replace('_', ' ')` em vez de "Turno". Isso garante que **qualquer ausência futura aparece corretamente sem precisar atualizar o exportador**.

#### 4. Validação visual obrigatória (QA)
Após a mudança, vou:
1. Gerar um PDF e um Excel de teste com uma escala que contenha `working`, `off`, `vacation`, `sick_leave` e `banco_horas` lado a lado.
2. Converter cada página do PDF em imagem e inspecionar para confirmar que "BANCO DE HORAS" aparece com a cor azul correta, sem clipping nem sobreposição.
3. Confirmar que o Excel também renderiza com cor azul.

### Mudanças técnicas

| Arquivo | Mudança |
|---|---|
| `src/lib/scheduleMasterPdf.ts` | `getCellText` trata `banco_horas` + fallback genérico para tipos desconhecidos; `didParseCell` pinta célula azul |
| `src/lib/scheduleMasterExport.ts` | `getCellValue` trata `banco_horas` + fallback genérico; novo `STYLE.bancoHoras`; `getCellStyle` retorna estilo correto |

### Resultado esperado

- Marcar "Banco de Horas" no editor de escalas → exportar PDF/Excel → célula aparece como `BANCO DE HORAS` em azul, idêntico à grid.
- Mesma coisa para FOLGA, FÉRIAS e ATESTADO (já funcionavam, continuam OK).
- Qualquer novo tipo de ausência adicionado no enum no futuro aparece automaticamente em vez de virar célula vazia.

### Validação pós-implementação

1. Editor de Escalas → marcar um colaborador como "Banco de Horas" em um dia.
2. Marcar outro como "Atestado", outro como "Férias", outro como "Folga", outro com turno normal.
3. Clicar em "Exportar Escala" → "Baixar PDF": conferir as 5 células com cores e textos corretos.
4. Mesma escala → "Baixar Excel": abrir e conferir as cores e textos.
5. Conferir que o resumo de almoço/jantar/POP no rodapé continua igual (não conta `banco_horas` como working — já está correto, pois filtra `schedule_type === "working"`).
