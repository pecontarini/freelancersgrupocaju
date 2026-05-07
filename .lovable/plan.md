## Objetivo
Garantir que toda escala gerada para o setor **Parrilla** abra automaticamente às **08:00**, em qualquer unidade e qualquer dia da semana, sem depender da decisão da IA.

## Diagnóstico
Hoje os templates do prompt (`supabase/functions/gerar-escala-ia/prompt.ts`) usam **09:00** como entrada padrão dos abridores (`ABRIDOR-DOBRA` e `ABRIDOR-DOBRA-PARCIAL` T1: 09h→14h). Como a IA copia esses templates, a Parrilla acaba abrindo às 09h. Não há override por setor.

A correção é em duas camadas, para ser determinística:

1. **Camada de prompt**: instruir a IA, quando o setor for Parrilla, a usar 08:00 como entrada do abridor (T1: 08h→13h, mantendo 5h efetivas e break de 3h).
2. **Camada de pós-processamento (garantia)**: no `index.ts`, depois de receber o JSON da IA, varrer todos os slots/vagas de papel `abridor` quando `setor === parrilla` e forçar `t1.entrada = "08:00"` (ajustando `saida` para manter as 5h e recalculando `efetivo_min`). Isso evita regressão se a IA "esquecer".

## Mudanças

### 1) `supabase/functions/gerar-escala-ia/prompt.ts`
- Adicionar bloco "REGRA ESPECÍFICA — PARRILLA" no SYSTEM_PROMPT:
  - Toda abertura da Parrilla começa às **08:00** (T1: 08h→13h | break 3h | T2 inalterado).
  - Vale para Tipo A, B e C (incluindo `ABRIDOR-DOBRA-PARCIAL`).
- Reforçar no `buildUserPrompt` quando `setor` normalizado for `parrilla`: linha explícita "ABERTURA DESTE SETOR: 08:00 (inegociável)".

### 2) `supabase/functions/gerar-escala-ia/index.ts`
- Após o parse do JSON da IA e antes da validação CLT, aplicar normalização:
  ```ts
  if (lemma(setor) === "parrilla") {
    forcarAberturaParrilla(escala); // ajusta slots[].t1 e plano_folgas.vagas[].horario_padrao.t1
  }
  ```
- A função ajusta apenas vagas/slots cujo `papel === "abridor"` ou `tipo` começa com `ABRIDOR`:
  - `t1.entrada = "08:00"`, `t1.saida = "13:00"`, `t1.efetivo_min = 300`
  - mantém break (180) e T2 como veio
  - recalcula `jornada_dia_min`

### 3) Sem mudanças de UI
A geração é via `gerar-escala-ia`; o `ScheduleAIGenerator` (chat) não precisa mudar. A garantia fica na edge function, então qualquer ponto de entrada respeita a regra.

## Verificação
- Disparar geração para um setor Parrilla de qualquer unidade e conferir que todos os abridores aparecem com T1 começando 08:00 nos 7 dias.
- Conferir que setores não-Parrilla (Cozinha, Bar, Garçom, etc.) seguem com 09:00.

## Pergunta rápida
Confirma que **todos os papéis de abertura** da Parrilla (abridor puro e abridor-dobra-parcial) devem entrar 08:00, ou só um papel específico (ex.: "parrilleiro abridor")? O plano acima assume **todos os abridores** da Parrilla.