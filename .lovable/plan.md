## Objetivo

Hoje o gerador de IA já sugere **um conjunto único** de dias de folga (`dias_folga_sugeridos`) aplicado igualmente a TODAS as vagas — ou seja, todo mundo folga no mesmo dia. Isso quebra o POP nos dias de folga e não respeita 5x2 (que exige 2 folgas por pessoa) nem distribui 6x1 entre o time.

Queremos que a IA:
1. Calcule a **necessidade total de pessoa-dia** (somando POP de almoço + jantar de cada dia da semana).
2. Calcule o **headcount disponível** com base no modelo de folga (6x1 → cada pessoa trabalha 6/7 dias; 5x2 → 5/7).
3. Distribua as folgas **escalonadas por vaga**, garantindo POP em todos os dias.
4. Retorne, junto com cada vaga (slot), **quais dias da semana aquela vaga folga**.

---

## Mudanças propostas

### 1. Prompt da IA (`supabase/functions/gerar-escala-ia/prompt.ts`)

Adicionar uma nova seção **"PLANEJAMENTO DE FOLGAS"** ao SYSTEM_PROMPT:

```
═══════════════════════════════
PLANEJAMENTO DE FOLGAS — DISTRIBUÍDO
═══════════════════════════════
Modelo 6x1: cada vaga folga em EXATAMENTE 1 dia/semana.
Modelo 5x2: cada vaga folga em EXATAMENTE 2 dias/semana (idealmente consecutivos).

ALGORITMO:
1. Some pop_almoco + pop_jantar de cada dia → demanda_dia (pessoas-turno).
2. Headcount mínimo = ceil(soma_demanda_semanal / dias_trabalhados_por_pessoa)
   (6x1 → divide por 6; 5x2 → divide por 5).
3. Distribua folgas de forma que, em cada dia, o nº de vagas em folga ≤
   (headcount_total - demanda_dia). Priorize folgar nos dias de menor demanda
   (geralmente SEG/TER).
4. Para 5x2, prefira pares consecutivos (SEG+TER, DOM+SEG) e nunca SEX/SAB.
5. Cada vaga deve ter um campo "folgas": ["DIA1", "DIA2"] no JSON.
```

E **alterar o formato de saída** para que cada slot expandido carregue suas próprias folgas:

```json
"vagas_planejadas": [
  {
    "id_vaga": "v1",
    "tipo": "ABRIDOR-DOBRA",
    "responsavel": false,
    "folgas": ["SEG"],
    "horario_padrao": { "t1": {...}, "break_min": 180, "t2": {...} }
  },
  ...
]
```

Os blocos `dias.SEG.slots[]` continuam existindo (para validação POP por dia), mas a fonte da verdade para envio ao editor passa a ser `vagas_planejadas`.

### 2. Edge function (`supabase/functions/gerar-escala-ia/index.ts`)

- Validar que `vagas_planejadas` existe e que, para cada dia, `headcount_em_campo ≥ demanda_dia`.
- Se 5x2/6x1 violado (folgas a mais ou a menos por vaga) → retornar 422 com `alertas_folga`.

### 3. Front-end (`src/components/escalas/GeradorEscalaIA.tsx`)

Substituir a lógica atual de "vaga por pessoa do pico + folga global" pela leitura direta de `resultado.vagas_planejadas`:

```ts
for (const vaga of resultado.vagas_planejadas) {
  const days: Record<string, DraftDay> = {};
  for (const d of DIAS) {
    days[dayDates[d]] = vaga.folgas.includes(d)
      ? { kind: "off" }
      : slotToDay(vaga.horario_padrao);
  }
  drafts.push({ ..., days, label: `Vaga ${vaga.tipo}` });
}
```

Adicionar uma **prévia visual** (tabela) mostrando: vaga × 7 dias, com células coloridas (trabalho/folga) antes de enviar ao editor.

### 4. UI — Novo painel "Plano de folgas"

Acima da tabela atual de "Slots por dia", mostrar:
- Demanda total de pessoa-dia (somatório).
- Headcount calculado pela IA.
- Mini-grid: linhas = vagas, colunas = SEG..DOM, células = ✓ trabalho / 🌙 folga.
- Aviso se algum dia ficar abaixo do POP (cor vermelha).

---

## Limitações / decisões

- **Folgas consecutivas no 5x2**: regra preferencial, não obrigatória — a IA pode quebrar se o POP exigir.
- **Domingo de folga preferencial**: já existe o fluxo "Domingo de folga" (`useSundayOff`) — a IA deve respeitar se ativo (passar como flag no userPrompt).
- **Não muda schema do banco**: `ai_draft_slots.days` já aceita `kind: "off"` por data, então a persistência é igual.

---

## Arquivos afetados

- `supabase/functions/gerar-escala-ia/prompt.ts` — novo bloco de regras + novo formato JSON.
- `supabase/functions/gerar-escala-ia/index.ts` — validações de folga.
- `src/components/escalas/GeradorEscalaIA.tsx` — consumir `vagas_planejadas`, remover lógica de "pico+folga global", adicionar prévia.
