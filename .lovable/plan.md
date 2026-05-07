## Problema

Para o setor GARCOM o gerador está produzindo só vagas de fechamento. Causa raiz dupla:

1. **Teto de headcount estrangulando o POP**: o log mostra `headcount_max=2` (só 2 garçons cadastrados). A lógica atual em `index.ts` (linhas 369-396) poda intermediários LIFO até caber em 2 vagas e nunca cria slots de almoço. Como `qtd_abridores`/`qtd_fechadores` para garçom geralmente estão zerados em `turno_config` (a estrutura abridor/fechador é típica de cozinha), tudo vira "intermediário" e é podado, sobrando só o que a IA jogou para o jantar.
2. **Prompt sem garantia explícita do POP de almoço para garçons**: o bloco "GARÇOM" da biblioteca de templates só descreve TIPO-ALMOCO e TIPO-FECHAMENTO, mas a regra de prioridade ("POP é piso absoluto, gerar mesmo sem gente") não está reforçada. Combinada com o teto, a IA aprende a sacrificar o almoço.

O usuário foi explícito: **a IA deve resolver o POP independente de ter pessoas contratadas**. Headcount vira aviso, não restrição.

## Plano

### 1. `supabase/functions/gerar-escala-ia/index.ts` — POP acima do headcount

- **Remover a poda de intermediários** (linhas 369-387). Substituir por: se `vagasRegulares.length > headcountMax`, NÃO podar — apenas adicionar `alertas_capacidade` informando o déficit ("Setor tem X pessoas mas POP exige Y vagas — contrate Z ou reduza POP").
- **Manter o downgrade 5x2 → 6x1** (linhas 358-366) só como otimização, mas sem bloquear se ainda exceder.
- **Garantir vagas de almoço para garçom**: após receber a resposta da IA, varrer `vagasRegulares` e, se nenhuma vaga cobre almoço (slot.t1.entrada ≤ 11:30 OU tipo contém "ALMOCO"/"ABRIDOR"), injetar vagas TIPO-ALMOCO usando `pop.almoco_efetivos` de cada dia como referência, com horário-padrão `10:30→16:00`. Marcar com `papel: "abridor"` para entrarem no mínimo diário.
- **Recalcular cobertura** (`calcularCobertura`) considerando explicitamente cobertura de almoço: novo campo `almoco_coberto_por_dia[d]` = nº de vagas em campo cujo `horario_padrao.t1.entrada <= 11:30`. Se < `pop.almoco_efetivos[d]`, incluir em `alertas_folga`.
- **Não bloquear nada**: alertas continuam viajando no payload com HTTP 200 (já é o comportamento, manter).

### 2. `supabase/functions/gerar-escala-ia/prompt.ts` — POP inegociável e templates de garçom

- **Reescrever o bloco "TETO DE HEADCOUNT"** em `buildUserPrompt`: o teto vira **referência informativa**, não restrição. Texto: "Headcount cadastrado é X — gere todas as vagas necessárias para cobrir POP almoço E POP jantar de cada dia, mesmo que ultrapasse X. O sistema sinalizará déficit de pessoal."
- **Adicionar regra dura para garçom no SYSTEM_PROMPT** (bloco GARÇOM da biblioteca):
  - Para todo dia em que `pop.almoco_efetivos > 0`, criar pelo menos `pop.almoco_efetivos` vagas com T1 começando às 10:30 (não depois das 11:00) → garante presença às 11:30.
  - Para todo dia em que `pop.jantar_efetivos > 0`, criar pelo menos `pop.jantar_efetivos` vagas TIPO-FECHAMENTO.
  - Vagas de almoço e jantar são **independentes** para garçom (sem dobras obrigatórias) — preferir DOBRA quando possível para economizar pessoas, mas nunca sacrificar o POP de almoço por falta de gente.
- **Reforçar prioridade**: "POP é PISO ABSOLUTO. Headcount real é apenas referência. Se faltar gente, gere as vagas mesmo assim."

### 3. `src/components/escalas/GeradorEscalaIA.tsx` — UI

- O banner amber de `alertas_capacidade` já existe; ajustar texto para refletir o novo comportamento ("Faltam contratar N pessoas — escala foi gerada com déficit, sinalize ao RH").
- Adicionar linha no resumo: "Cobertura almoço: ✓/⚠ (X/Y dias OK)" e "Cobertura jantar: ✓/⚠".

### Verificação

Setor GARCOM Caju Limão Itaim com `headcount_max=2` e POP almoço=4/jantar=5:
- Antes: gera só 2 vagas de fechamento.
- Depois: gera 4 vagas TIPO-ALMOCO (10:30–16:00) + 5 vagas TIPO-FECHAMENTO + banner amber "Setor tem 2 pessoas, POP exige 9 vagas — contratar 7".
- `cobertura_por_dia_calc` mostra abridor_em_campo ≥ 4 todos os dias.

### Arquivos afetados

- `supabase/functions/gerar-escala-ia/index.ts` (remoção da poda + injeção de vagas de almoço + cobertura)
- `supabase/functions/gerar-escala-ia/prompt.ts` (POP > headcount + regra explícita garçom almoço)
- `src/components/escalas/GeradorEscalaIA.tsx` (mensagem dos banners + linha de cobertura)
