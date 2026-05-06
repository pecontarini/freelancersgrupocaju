
## Diagnóstico

### Problema 1 — Felipe não vê as vagas
O store `useAIDraftSlots` é **memória local do navegador** (`useSyncExternalStore` com array em módulo). Quando você clicou "Enviar para o Editor", as vagas só existem **na sua aba**. Felipe (mesmo sendo admin global) abre o Editor e o array está vazio — não há nada para ler do banco. O modelo "só persiste ao vincular" só funciona se a mesma pessoa que gera é a mesma que vincula, em uma única sessão. Para colaboração precisa virar dado persistido.

### Problema 2 — 21 vagas para 13 pessoas necessárias
A contagem atual em `GeradorEscalaIA.tsx` (~linha 234) faz:
1. Agrupa slots por `(tipo, responsavel)` — ex: "Cozinheiro", "Cozinheiro responsável", "Aux. Cozinha", etc.
2. Para **cada grupo**, pega `maxQty` (a maior quantidade vista em qualquer dia da semana) e gera `maxQty` linhas-vaga.
3. Resultado: soma-se cargos diferentes. Se a matriz pede 5 cozinheiros + 8 auxiliares + 5 chefes em algum momento da semana, viram 18 linhas — mesmo que no PICO real só estejam 13 pessoas escaladas juntas.

Você escolheu **"1 vaga por pessoa do PICO"**: a contagem precisa ser feita no nível do pico semanal (qual dia/turno tem maior soma total de pessoas em campo), não somando máximos por cargo.

### Problema 3 — varredura geral (achados durante a leitura)
- `linkDraftToEmployee` chama `upsertSchedule` em paralelo via `Promise.allSettled`. Cada upsert roda um `SELECT` de checagem de duplicidade — em 7 dias, são 7 selects + 7 upserts simultâneos. Sob RLS de admin global isso quase nunca falha, mas para operadores com acesso restrito por unidade pode estourar erro silencioso. Trocar para `Promise.all` propaga o erro real.
- `useUpsertSchedule` (hook) define `break_duration ?? 60` quando `params.break_duration` é `undefined`. Para folgas mandamos `0`, ok. Para drafts mandamos `day.break_min ?? 0`. Sem problema, mas se algum dia do draft vier com `break_min: undefined`, vira 60 e quebra a interpretação. Precisa garantir `Number(...)` explícito.
- Não há feedback claro quando o setor de destino tem matriz vazia ou job titles inexistentes — geração pode produzir 0 vagas e o operador não entende o que fazer.

## Proposta — em 3 frentes

### A. Persistir as vagas IA no banco (resolve Felipe)

Criar tabela `ai_draft_slots` com RLS por unit:
```
id uuid PK
unit_id uuid NOT NULL
sector_id uuid NOT NULL
week_start date NOT NULL
label text
tipo text
responsavel boolean
days jsonb            -- { "2026-05-04": {kind:"work", start_time, end_time, break_min, shift_type}, ... }
created_by uuid
created_at timestamptz
```
RLS: SELECT/INSERT/DELETE por `user_has_access_to_loja(auth.uid(), unit_id)` OR `has_role(auth.uid(), 'admin')`.

Substituir o store em memória por hook React Query (`useAIDraftSlots(unit, sector, week)`) que lê/insere/deleta da tabela. Mantém a mesma API (`setDraftSlots`, `removeDraftSlot`, `clearDraftSlotsFor`, `updateDraftSlotDay`) mas agora persistida. Realtime opcional (subscribe na tabela) para que quando a Maria gerar, o Felipe veja aparecer sem refresh.

Ao **vincular** uma vaga a um funcionário: continua o fluxo atual (cria 7 schedules) e depois **deleta a linha de `ai_draft_slots`** (em vez de remover do array em memória).

### B. Recontagem das vagas pela "pessoa do pico" (resolve as 21 vagas)

Reescrever a derivação de quantidade no `enviarParaEditor`:

1. Para cada dia da semana, calcular **total de pessoas em campo simultaneamente** olhando a janela de pico (almoço 12:00–14:00 OU jantar 20:00–22:00 — pegar o maior). Soma de todos os slots cobrindo aquela hora.
2. **Pico semanal** = maior valor entre os 7 dias.
3. Distribuir o pico entre cargos: para cada cargo distinto, contar quantos slots desse cargo estão no momento do pico. Total deve bater com o pico.
4. Gerar **uma linha-vaga por pessoa esperada no pico**, não por máximo por cargo.

Exemplo: se no jantar de sexta o pico for 13 pessoas (5 cozinheiros + 6 aux + 2 chefes) → 13 linhas, com horários que cada uma cobre o dia todo da semana usando o turno-padrão (moda) do cargo correspondente. Folgas continuam como hoje.

Adicionar no banner do Editor: *"13 vagas — pico identificado em SEX 20:00 (5 Cozinheiro + 6 Aux + 2 Chefe)"* para o operador entender de onde veio o número.

### C. Robustez do fluxo (varredura)

- `linkDraftToEmployee`: trocar `Promise.allSettled` por `Promise.all` envolto em `try/catch` que mostra qual dia falhou. Mostrar contagem de sucesso vs falha no toast.
- `slotToDay`: garantir `Number(diffMin(...))` e clamp em 0..600 minutos para `break_min`.
- Se o setor não tem `staffing_matrix` ou job titles vinculados, mostrar aviso visível no Gerador antes mesmo de chamar a IA: *"Setor X sem matriz POP configurada — configure em Cargos e Setores antes de gerar"*.
- Adicionar log estruturado (tabela `ai_generation_audit` opcional, ou só `console.info` por enquanto) com: usuário, setor, semana, qtd vagas geradas, pico identificado, modelo de folga. Facilita auditar quando alguém pergunta "de onde vieram essas vagas".
- Banner do Editor passa a mostrar **quem** criou as vagas e **quando**: *"13 vagas geradas por Pedro às 17:38 aguardando vínculo"*.

## Ordem de execução proposta

1. Criar tabela `ai_draft_slots` + RLS (migration).
2. Refazer `useAIDraftSlots` como hook React Query lendo/escrevendo da tabela; manter assinatura igual para o resto do código quase não mudar.
3. Atualizar `GeradorEscalaIA.enviarParaEditor` para inserir na tabela em vez do store local.
4. Reescrever a contagem de vagas (lógica do pico).
5. Endurecer `linkDraftToEmployee` (Promise.all + relatório).
6. Banner com "criado por X em Y", contador correto, justificativa do pico.
7. (Opcional) realtime subscribe para outros usuários verem na hora.

Sem perguntas adicionais — implementarei direto se você aprovar.
