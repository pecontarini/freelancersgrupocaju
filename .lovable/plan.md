# Gerador Automático de Escalas (IA + POP + CLT)

## É possível? Sim — com escopo realista

Sim, dá para construir. A chave é **não deixar a IA "criar escala do nada"**: ela deve trabalhar como um **copiloto restrito** que recebe as regras do POP + CLT como contrato e devolve uma sugestão estruturada que passa por **validador determinístico** antes de virar opção para o usuário aplicar no grid de escalas.

Em uma frase: a IA propõe, o validador (código) aprova, o usuário confirma, o grid aplica.

## Como vai funcionar (visão do usuário)

Dentro do módulo Escalas, novo botão **"Gerador IA"** abre um chat lateral parecido com o da Agenda do Líder. O fluxo é:

1. Usuário escolhe semana e setor (ex: Cozinha, semana 04-10/05).
2. Chat mostra automaticamente o que já tem na base: funcionários ativos do setor, Tabela Mínima POP do setor, férias/atestados marcados, banco de horas atual.
3. Usuário descreve a necessidade em linguagem natural: *"Preciso montar a escala da cozinha. João está de férias. Maria pediu folga sábado. Não quero estourar 44h de ninguém."*
4. IA responde com:
  - **Resumo** do que entendeu (em texto curto).
  - **Sugestão de escala completa** (tabela funcionário × dia × turno).
  - **Selo de validação CLT/POP** ao lado de cada linha (verde / amarelo / vermelho com motivo).
  - **Avisos** ("não foi possível cobrir o jantar de quinta — falta 1 cozinheiro, sugiro freelancer").
5. Botões: **"Aplicar no grid"** (preenche as células do ManualScheduleGrid existente, sem salvar — usuário ainda revisa e confirma) ou **"Refinar"** (continua o chat).

A IA **só responde sobre escalas** e **só sugere combinações que passam no validador**. Se o usuário pedir algo proibido ("escale fulano 12h"), ela explica o que o POP/CLT diz e oferece a alternativa válida mais próxima.

## Regras que a IA será obrigada a respeitar

Extraídas do POP de Escalas + CLT (codificadas no validador, não só no prompt):

**CLT / Jornada (POP item 4.2.5 e 5):**

- Máximo 44h/semana por colaborador.
- Máximo 10h/dia (8 normais + 2 extras).
- Mínimo 11h de interjornada entre dois turnos.
- Em dia de dobra, intervalo entre turnos não pode ser maior que 4h.
- Mínimo 1 folga semanal + pelo menos 1 domingo de folga no mês (ou compra/troca prevista no acordo coletivo).

**POP de Escalas (item 4.1 + 4.2):**

- Tabela Mínima por setor/turno/dia da semana é **piso obrigatório** (já existe na tabela `staffing_matrix`).
- Não pode reduzir o quantitativo total de contratados por setor.
- Aviso prévio, férias e atestados bloqueiam escalação no período.
- Considerar competência: não concentrar todos os experientes em um turno só (sinalizar como "warning", não bloqueio).
- Critérios de presença válida no turno: mínimo 2h consecutivas entre 12-15h (almoço) ou 19-22h (jantar).

**Banco de horas (POP 3.3.4 + 3.4.4):**

- Priorizar quem tem banco positivo para folga e quem tem banco negativo para convocação.
- Evitar criar novo desequilíbrio.

**Custo (POP 3.3.2 + 5.1.3):**

- Só sugerir freelancer depois de tentar realocação interna e banco de horas.

## Como construirei (técnico)

### 1. Edge Function `gerar-escala-ia`

Novo arquivo em `supabase/functions/gerar-escala-ia/index.ts` no mesmo padrão de `agenda-lider-chat`:

- Lovable AI Gateway, modelo `google/gemini-2.5-pro` (precisa de raciocínio sobre tabela grande).
- System prompt **carrega o POP completo** + glossário CLT em texto fixo (≈3k tokens, cabe sem problema).
- Recebe contexto operacional já filtrado: funcionários do setor, tabela mínima, ausências, banco de horas, escala atual da semana.
- Tool calling com função `propor_escala(turnos[])` retornando array de `{ employee_id, date, shift_type, start, end, break_min }`.

### 2. Validador determinístico (`src/lib/escalas/popValidator.ts`)

Função pura que recebe a proposta da IA e devolve `{ valid, violations[], warnings[] }`. Roda **antes** de mostrar para o usuário. Se houver violação dura (CLT ou POP mínimo), o chat pede que a IA refaça automaticamente (1 retry) com a violação explicada. Reaproveita lógica que já existe em `useStaffingMatrix`, `usePopCompliance`, `WeeklyHoursSummary`, `peakHours.ts`.

### 3. UI — `ScheduleAIGenerator.tsx` (novo)

- Acessível por botão dentro de `ManualScheduleGrid.tsx` (ao lado do botão "Atalhos" existente).
- Abre painel lateral / Sheet com chat (mesmo visual da Agenda do Líder — `MissoesChatView` como referência).
- Renderiza markdown + tabela de proposta + badges de validação.
- Botão "Aplicar no grid" usa o mesmo path de `applyPatchToCells` que já criamos para copiar/colar — então as células vão para estado *dirty*, não vão direto pro banco. Usuário ainda salva manualmente.

### 4. Hook `useScheduleAIContext.ts`

Junta num único objeto tudo que a IA precisa: funcionários ativos da unidade/setor, `staffing_matrix` da semana, férias/atestados via `useManualSchedules`, banco de horas resumido por colaborador, praças.

### 5. Limitação de escopo do chat

System prompt fecha a IA no domínio: se o usuário perguntar qualquer coisa fora de escalas (ex: "escreva um email", "qual a capital da França"), responde *"Sou o assistente de escalas — só consigo ajudar com montagem de escala respeitando o POP e a CLT"*. Sem tool calling = sem proposta = nada é aplicado.

## Limitações honestas

- **Não vai gerar escala de mês inteiro com 100% de cobertura no primeiro clique** se a unidade tiver muitas faltas/férias e quadro apertado. Vai dizer claramente onde sobra furo e sugerir freelancer ou banco de horas.
- **Banco de horas** entra na decisão, mas o saldo exato vem do que existir hoje no sistema; se não houver fonte estruturada, a IA usa apenas as horas já lançadas no grid da semana.
- **Acordo coletivo de troca de domingo** será tratado como flag opcional no chat ("posso usar troca de domingo? sim/não") — não vou inferir sozinho.
- IA é sugestão. Decisão e responsabilidade legal continuam com o Proprietário/Gerente, como o POP exige.

## Arquivos que serão criados/alterados

**Novos:**

- `supabase/functions/gerar-escala-ia/index.ts` — chat IA + tool `propor_escala`
- `src/lib/escalas/popValidator.ts` — validador CLT + POP determinístico
- `src/lib/escalas/popRulesText.ts` — POP em texto, alimenta o system prompt
- `src/hooks/useScheduleAIContext.ts` — junta contexto operacional
- `src/components/escalas/ScheduleAIGenerator.tsx` — painel lateral com chat e proposta

**Alterados:**

- `src/components/escalas/ManualScheduleGrid.tsx` — botão "Gerador IA" no header (junto ao "Atalhos") + handler `applyAIProposal` reusando `applyPatchToCells`

Sem mudanças de schema, sem novas dependências, sem alteração visual do grid.

## Pergunta antes de implementar

Quer que a sugestão da IA, ao ser aplicada, **já salve no banco** ou apenas **preencha o grid em modo rascunho** (usuário ainda confirma com Salvar, igual hoje quando edita manual)? A segunda é mais segura e é meu padrão recomendado — só confirmo se concorda.  
Ao gerar em grid, modo rascunho, o painel pede a senha de assinatura do responsável da escala, salva e gera automaticamente. Mas com confirmação antes 