# Plano — Tornar o Gerador de Escalas IA mais inteligente

Hoje o gerador (`supabase/functions/gerar-escala-ia`) é forte em cobrir POP almoço/jantar e folgas balanceadas, mas tem **quatro lacunas estruturais**: ele desenha vagas (não pessoas), só conhece a unidade Caju Limão Itaim, não enxerga histórico real, e não se autovalida. Abaixo, eixos de melhoria — do mais alto impacto ao mais incremental.

## Eixo 1 — Sair de "vagas" e ir para "pessoas reais" (maior impacto)

Hoje a IA devolve um molde de vagas; vincular nome a vaga é manual depois. Proposta:

- Enviar à IA a **lista de funcionários ativos do setor** (já temos em `useScheduleAIContext`), com:
  - Cargo, tipo (CLT/freelancer), carga semanal alvo (44h, 36h, 30h…).
  - **Papel preferido** (abridor / fechador / intermediário) — campo novo opcional em `employees` ou em uma tabela `employee_role_preferences`.
  - **Folga fixa** quando houver (campo `dia_folga_fixo`).
  - Restrições: aprendiz, gestante, menor de 18 (sem fechamento), em férias/atestado nas próximas semanas.
- A IA passa a devolver `vagas` **já com `employee_id`** atribuído. O frontend só precisa confirmar (e o usuário pode reatribuir).
- Vantagem: a saída cai direto na grade sem o passo "Vincular".

## Eixo 2 — Contexto operacional dinâmico (multi-unidade)

Hoje horários de fechamento, picos e regra Parrilla estão **hardcoded no prompt**. Outras unidades (Caminito, Nazo, Foster's) não são bem servidas.

- Criar tabela `unit_operating_profile` (ou estender `units`):
  - `abertura`, `fechamento_por_dia` (jsonb por dia), `pico_almoco_inicio/fim`, `pico_jantar_inicio/fim`, `quebra_break_min`, `dobra_viavel_por_dia` (regra de fechamento).
- Criar tabela `sector_operating_rules` para exceções como "Parrilla abre 08:00":
  - `abertura_override`, `fechamento_override`, `templates_extras` (jsonb).
- O `buildUserPrompt` passa a **gerar o bloco "CONTEXTO OPERACIONAL" e os "TEMPLATES" a partir desses dados** em vez de string fixa. Isso permite ligar o gerador para todas as 4 marcas sem editar código.

## Eixo 3 — Continuidade entre semanas e CLT real

Atualmente a IA "começa do zero" toda semana. Erros típicos: viola interjornada de 11h entre o último turno da semana anterior e o primeiro da semana nova; ignora se a pessoa **já teve folga dominical** no mês.

- Incluir no prompt um bloco **"ESTADO DAS PESSOAS"** com:
  - Último turno trabalhado (data + hora fim) → para validar interjornada na 1ª segunda.
  - Horas já lançadas no mês corrente (banco de horas / extras).
  - Domingos de folga já gozados no mês (já temos `useEmployeeSundaysOff`). A IA é instruída a **garantir 1 domingo de folga por mês** rotativamente.
  - Atestados/férias futuras (já temos via `absences`).
- Validação determinística pós-IA (no edge function) que rejeita escalas que violem essas restrições e re-pede correção (ver Eixo 6).

## Eixo 4 — Demanda real, não só piso POP

Hoje o piso POP é o único guia de demanda. Em dias atípicos (feriado, evento, copa, fim de mês) a escala fica subdimensionada ou sobrada.

- Enviar à IA, por dia da semana-alvo:
  - **Forecast de vendas** (`daily_budgets` + média histórica das últimas 4 semanas do mesmo dia).
  - **Eventos do calendário** (feriado nacional/municipal, jogo, data sazonal — vem da `agenda_eventos` ou tabela nova).
  - **Reservas confirmadas** se existir integração futura.
- A IA passa a justificar quando sobe acima do POP (`extras_almoco`, `extras_jantar`) ligando ao forecast.

## Eixo 5 — Modelo e raciocínio mais fortes

Hoje: `google/gemini-2.5-flash`, `max_tokens: 16000`, sem reasoning.

- Trocar para **`google/gemini-2.5-pro`** ou **`openai/gpt-5`** com `reasoning: { effort: "medium" }`.
  - Custo sobe, mas é uma chamada por setor/semana — investimento bem direcionado.
  - Pro lida muito melhor com a combinatória de folgas + dobras + CLT.
- Manter o flash atual como **fallback** quando o Pro retornar 429/402 (já há retry, basta rotear).

## Eixo 6 — Loop de auto-validação (a IA refaz quando erra)

Hoje o edge function detecta violações (POP, folgas, papel) e tenta **podar/injetar vagas deterministicamente**. Esse remendo às vezes desfaz a inteligência da IA.

- Substituir por um **loop de 1 reprompt**: se a 1ª resposta tiver `alertas_folga` críticos ou cobertura insuficiente, mandamos de volta:
  > "Sua resposta violou X, Y, Z. Gere de novo corrigindo apenas estes pontos, mantendo o resto."
- Se mesmo o reprompt falhar, aí sim cai no fallback determinístico atual.
- Resultado: respostas mais coerentes, menos vagas "auto_injetadas" sem alma.

## Eixo 7 — Aprendizado leve (preferências da casa)

Hoje cada geração esquece o que a casa decidiu na semana anterior. Sem virar ML pesado, dá para ter **memória institucional**:

- Tabela `escala_aprendizados` por unidade/setor:
  - "João nunca fecha", "Maria sempre dobra terça", "Domingo é folga rotativa do bar".
  - Itens vêm de (a) edição manual repetida que sobrescreveu a IA, ou (b) registros explícitos em "Cargos e Setores".
- Esses aprendizados entram no prompt como bullets curtos antes da geração.

## Eixo 8 — Qualidade de saída e UX da revisão

- Devolver, junto com a escala, um **resumo executivo em 3 linhas** ("Esta semana 8 vagas, 2 dobras críticas em qui/sex, 1 alerta de domingo sem folga para Carlos") — para o líder decidir mais rápido.
- Devolver `score_qualidade` (0–100) baseado em: cobertura POP, equilíbrio de folgas, respeito a preferências, aderência a forecast.
- Frontend mostra esse resumo no painel da IA antes do botão "Aplicar".

## Quick wins (semana 1, baixo risco)

1. Subir o modelo para `google/gemini-2.5-pro` com `reasoning: medium` (1 linha de código).
2. Incluir `weekDates` reais (datas, não só dia da semana) e os **funcionários ativos** no prompt — dá nome às vagas.
3. Bloco "ESTADO DAS PESSOAS" com domingo-de-folga e último turno da semana anterior.

## Médio prazo (2–3 sprints)

4. Tabelas `unit_operating_profile` e `sector_operating_rules` + remover hardcode Caju/Parrilla.
5. Loop de reprompt (Eixo 6).
6. Forecast de vendas e eventos no prompt.

## Longo prazo

7. Aprendizados institucionais persistidos.
8. Score de qualidade + resumo executivo + multi-setor (gerar várias semanas/setor de uma vez com coerência cruzada).

## Pergunta para você

Para focar a implementação: prefere começar pelos **Quick wins** (resultado visível na próxima geração), pelo **Eixo 1** (a IA já entrega com nome → corta 80% do trabalho manual de vincular), ou pelo **Eixo 6** (parar de ver vagas auto-injetadas sem critério)?
