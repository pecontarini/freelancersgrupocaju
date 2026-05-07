## Diagnóstico

A queixa procede. No setor CUMIN (e em qualquer setor), quase todas as vagas estão folgando segunda e terça por **dois motivos combinados** em `supabase/functions/gerar-escala-ia/index.ts`:

### 1. O reparo determinístico de abridor/fechador concentra folgas no início da fila de prioridade

Linhas 230–242: para cada vaga, calcula-se um `offset = (idx * folgasPorVaga) % 7` e aplica-se sobre `prioridadeFolgas` (que está ordenada pela menor demanda). No 5x2 com 2 folgas/vaga e poucas vagas (típico de CUMIN: 2–3 abridores/fechadores), o índice 0 sempre cai em SEG+TER, o índice 1 em QUA+QUI, etc. Como geralmente há só 2–3 vagas por papel, a maioria fica de fato em SEG+TER.

Além disso, `capacidadeFolgaPorDia = vagasDoPapel.length - minimos[papel]` é constante para todos os dias da semana — não reflete a demanda real. Se há 3 vagas e mínimo 1, o algoritmo permite até 2 folgas em QUALQUER dia, inclusive SAB/DOM, mas a rotação por offset puxa tudo pro começo da prioridade.

### 2. Intermediários e demais papéis não têm reparo nenhum

O loop de reparo (linha 211) só roda para `["abridor", "fechador"]`. Os intermediários ficam com o que a IA gerou — e o prompt instrui explicitamente "Priorize folgar em dias de MENOR demanda (SEG/TER/QUA)" (prompt.ts linha 109). A IA obedece e empilha tudo em SEG+TER.

Resultado: 100% das vagas folgam SEG/TER, deixando QUI–DOM (alta demanda) com headcount alto, mas SEG/TER fica em mínimo absoluto e qualquer falta vira crise.

## Plano de Correção

Editar `supabase/functions/gerar-escala-ia/index.ts`:

### A. Distribuir folgas de forma balanceada (não só "menor demanda primeiro")

Substituir `prioridadeFolgas` por uma fila que considere capacidade por dia baseada em **demanda real**, não só ranking:

- Calcular `capacidadeFolgaPorDia[dia] = vagasDoPapel.length - max(minimos[papel], demanda_papel_estimada[dia])`.
- Para 5x2, ao escolher 2 folgas por vaga, preferir pares consecutivos (SEG+TER, TER+QUA, DOM+SEG) e **distribuir as vagas em pares diferentes** ciclicamente, não pelo offset linear da lista priorizada.
- Adicionar trava: nenhum dia pode receber mais de `ceil(vagasDoPapel.length * folgasPorVaga / 7) + 1` folgas do mesmo papel (espalhamento forçado).

### B. Aplicar o mesmo reparo a intermediários e demais vagas regulares

Estender o loop para incluir `intermediario` e qualquer vaga regular sem papel mapeado. Critério de mínimo diário para intermediários: usar `demanda_por_dia[dia] - (abridores_em_campo + fechadores_em_campo)` como piso, garantindo que a folga não derrube `headcount_total - folgas[dia] < demanda_por_dia[dia]`.

### C. Pós-validação anti-concentração (regra dura)

Após o reparo, calcular `folgasPorDia[dia]` somando todas as vagas regulares. Se algum dia concentra > 50% das folgas semanais totais, redistribuir movendo folgas excedentes para o próximo dia com capacidade livre. Adicionar alerta em `plano.avisos_distribuicao_folgas`.

### D. Ajuste no prompt (prompt.ts)

Suavizar a instrução "Priorize folgar em dias de MENOR demanda" para "Distribua folgas de forma BALANCEADA ao longo da semana, evitando concentrar mais de 40% das folgas no mesmo dia. Dias de menor demanda recebem folgas marginalmente mais; nunca todas".

### E. Teste

Após o deploy, chamar a função para CUMIN / 2026-05-05 / 5x2 e verificar que `cobertura_por_dia_calc` mostra headcount > mínimo+1 em SEG/TER (não só mínimo cravado), e que nenhum dia concentra mais que ~30% das folgas.

## Arquivos afetados

- `supabase/functions/gerar-escala-ia/index.ts` (lógica de reparo e validação)
- `supabase/functions/gerar-escala-ia/prompt.ts` (instrução de balanceamento)
