## Objetivo

Garantir que a semana **11–17/05/2026 do Caju Itaim** tenha um **template completo de escala em todos os 10 setores**, com horários de abertura/fechamento e vagas dimensionadas pelo POP, prontos para a liderança vincular pessoas no Editor de Escalas.

## Situação atual

| Setor | Template 11/05? | Vagas | Schedules já replicados (11–17) |
|---|---|---|---|
| BAR | sim | 12 | 28 |
| COZINHA | sim | 16 | 55 |
| CUMIN | sim | 23 | 0 |
| GARÇOM | sim | 23 | 0 |
| HOSTESS | sim | 4 | 0 |
| PARRILLA | sim | 6 | 7 |
| PRODUÇÃO | sim | 12 | 49 |
| **CHEFE E SUBCHEFE** | **não** | — | 0 |
| **DELIVERY** | **não** | — | 0 |
| **SERVIÇOS GERAIS SALÃO/BAR** | **não** | — | 0 |

Decisão aprovada: **regerar TODOS os 10 setores via IA, modelo 5x2**, sobrescrevendo os 7 templates existentes e criando os 3 faltantes. As 139 escalas replicadas em `schedules` permanecem intactas (são vínculos pessoa↔dia, separados do template de horários).

## O que vou construir

### 1. Botão "Gerar para TODOS os setores" no `GeradorEscalaIA.tsx`

Adicionar ao topo do gerador, ao lado do seletor de setor atual, um botão **"Gerar todos os setores desta unidade (5x2)"** que:

1. Lê todos os setores ativos da unidade (`sectors` + `turno_config` + `staffing_matrix`).
2. Itera SEQUENCIALMENTE (não paralelo, p/ não estourar rate-limit do Lovable AI) chamando `supabase.functions.invoke("gerar-escala-ia", { setor, semana_inicio, unidade_id, modelo_folga: "5x2" })` para cada setor.
3. Mostra progresso em tempo real: `Gerando 4/10 — COZINHA…` com barra de progresso.
4. Coleta resultado por setor: ✓ sucesso (vagas geradas) | ⚠ aviso (gerou com alertas POP/CLT) | ✗ falha (motivo).
5. No final, exibe resumo em tabela com link "Abrir no editor" por setor que sucedeu.
6. A edge function `gerar-escala-ia` já faz UPSERT em `escala_template` (unique key `unidade_id, setor, semana_inicio`), então sobrescrever é automático — não precisa deletar antes.

### 2. Pré-checagem de pré-requisitos por setor

Antes de chamar a IA, validar para cada setor:
- Tem registro em `turno_config` (qtd_abridores/fechadores/intermediarios)?
- Tem matriz de staffing em `staffing_matrix` para os 7 dias?
- Tem `escala_minima` populada?

Setores sem pré-requisitos são listados num bloco "Pulei estes setores" com motivo claro (ex.: "DELIVERY: falta `turno_config`. Configure em `Mínimos & Configurações` antes."), em vez de gerar template vazio ou erro 500.

### 3. Validação pós-geração

Após o loop, exibir alerta se algum setor ficou:
- Sem template no fim (falhou) → CTA para retry só desse setor.
- Com `validacao.aprovado=false` → mostrar alertas POP/CLT/folga retornados pela IA.

### 4. Sem alteração de schema nem de edge function

A edge function `gerar-escala-ia` já existe, já normaliza setor, já salva em `escala_template` com upsert e já roda validador POP. Tudo o que precisa é a orquestração no front.

## Fluxo do usuário (resultado final)

1. Liderança abre **Escalas → Gerador IA**, seleciona unidade **CAJU - ITAIM**, semana **11/05/2026**.
2. Clica **"Gerar todos os setores (5x2)"**.
3. Acompanha a barra de progresso (~30–60s por setor, ~5–10min no total).
4. Vê o resumo: 10 setores processados, X sucessos, Y avisos, Z pulados por falta de config.
5. Para cada setor com sucesso, clica **"Enviar para o editor"** (fluxo já existente, um a um) ou usa o botão extra **"Enviar TODOS para o editor"** que itera o `enviarParaEditor` existente para cada `template_id` com vagas alocadas.
6. No Editor de Escalas, a liderança apenas atribui pessoas reais a cada vaga já dimensionada.

## Detalhes técnicos

- Componente: `src/components/escalas/GeradorEscalaIA.tsx` (modificar; manter fluxo single-sector intacto).
- Hook auxiliar: usar query existente de `sectors` por unidade; combinar com `turno_config` e `staffing_matrix` (pode reaproveitar `useStaffingMatrix`).
- Sequencial com `for…of` + `await` para evitar 429 do gateway.
- Estado de progresso: `useState<{ idx: number; total: number; current: string; results: Array<{setor; status; vagas; alertas}> }>`.
- Toast no final + `queryClient.invalidateQueries(["escala-template", unidadeId, semana])`.
- Sem migração SQL.

## Riscos e mitigação

- **Rate limit Lovable AI** → execução sequencial + delay de 1s entre chamadas.
- **Setor sem `turno_config`** → pular com mensagem (não tenta gerar) — evita ruído de erro.
- **Template já existente** → upsert sobrescreve (comportamento desejado e confirmado pelo usuário).
- **Schedules existentes (139 já replicados)** → não tocados; convivem com o novo template porque template define vagas/horários e schedules já são vínculos pessoa-data.