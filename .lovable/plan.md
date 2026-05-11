# Fix: "Cannot read properties of undefined (reading 't1')"

## Causa
Após o upgrade para `gemini-2.5-pro`, a IA às vezes retorna `vagas[]` sem `horario_padrao: { t1, t2 }` — ou retorna `null`/`undefined`, ou usa `entrada`/`saida` no nível da vaga. O `slotToDay(v.horario_padrao)` em `GeradorEscalaIA.tsx:327` quebra ao tentar ler `.t1` de `undefined`.

## Mudanças (apenas em `src/components/escalas/GeradorEscalaIA.tsx`)

### 1. `slotToDay` defensivo (~linha 296)
- Aceitar `horario: any | undefined`.
- Se `null`/`undefined` → `return null`.
- Se faltar `t1`/`t2`, tentar fallbacks: `horario.entrada`/`horario.saida`, ou objeto raiz com `entrada`/`saida`.
- Validar formato `HH:MM` antes de retornar.

### 2. Loop de vagas (~linhas 325-344)
- Ler horário em cascata: `v.horario_padrao ?? v.horario ?? v`.
- Se `slotToDay` retornar `null`, contar como vaga inválida e **continuar** (não derrubar o lote inteiro).
- Acumular contadores: `vagasIgnoradas`, `vagasOk`.

### 3. Feedback ao usuário
- Após o loop: se `drafts.length === 0` e `vagas.length > 0` → toast de erro "IA não retornou horários válidos. Tente regenerar."
- Se `vagasIgnoradas > 0` mas houve algumas válidas → toast de warning "{n} vagas ignoradas por horário inválido."

### 4. Log diagnóstico
- `console.warn("[GeradorEscalaIA] vaga sem horário válido:", { keys: Object.keys(v), sample: v.horario_padrao })` — apenas a primeira ocorrência por geração, sem PII.

## Fora de escopo
- Sem mudanças no edge function nem no prompt.
- Padronização do output da IA fica para Eixo 8 futuro.
