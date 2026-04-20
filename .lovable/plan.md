

## Plano: corrigir 100% o erro `duplicate key … unique_active_schedule`

### Causa raiz (3 camadas)

1. **Funcionários duplicados em `employees`**: a unidade Nazo GO tem 2 OBERDAN, 2 MARISON, 2 "A CONTRATAR" ativos (mesmo nome, sem CPF). O parser do Excel resolve cada linha para um `employee_id` qualquer entre os homônimos → a dedup por `(employee_id, data, setor)` não enxerga como duplicado, mas **na realidade** são a mesma pessoa lógica em setores diferentes da mesma planilha multi-setor.
2. **Dedup só por employee_id**: hoje deduplicamos por `(employee_id|date|sector_id)`. Quando a planilha tem o mesmo nome em 2 setores no mesmo dia (caso normal de funcionário polivalente), passam 2 linhas para o `INSERT`, que então conflita com a unique constraint **se** ambas resolverem para o mesmo employee_id, ou geram registros duplicados se resolverem para IDs diferentes.
3. **Mensagem de erro genérica**: o usuário não entende qual linha causou o conflito.

### Solução em 4 frentes

#### Frente 1 — Limpar duplicatas históricas (migration)
- **Função SQL `merge_duplicate_employees(unit_id)`**: para cada `(unit_id, name)` com 2+ registros ativos sem CPF, escolher o mais antigo como "canônico" e:
  - Repontar `schedules.employee_id`, `freelancer_entries.employee_id` (e qualquer FK) para o canônico.
  - Marcar os outros como `active=false` com nome `"[MERGED] <nome>"`.
- Executar para todas as unidades no momento da migration (one-shot backfill).

#### Frente 2 — Prevenir novas duplicatas (constraint + UI)
- Adicionar **índice único parcial** em `employees`: `(unit_id, lower(name))` WHERE `active = true AND cpf IS NULL`. Com CPF, a unicidade já vem por CPF.
- No `registerUnmatchedEmployees` do `ScheduleExcelFlow.tsx`: antes de inserir, fazer lookup por nome+unit_id; se já existir ativo, reusar o ID em vez de criar novo.
- No `FreelancerAddModal` e no fluxo de cadastro manual: mesmo lookup defensivo.

#### Frente 3 — Dedup robusto na importação
Em `ScheduleExcelFlow.tsx → handleConfirmImport`:
- **Dedup por (nome normalizado + data)** *antes* de resolver IDs: se a planilha tem o mesmo nome em 2 setores no mesmo dia, manter a primeira ocorrência (preferindo `working` sobre `off`).
- Após a dedup intra-batch atual, antes do `INSERT`, fazer um **upsert via `onConflict: 'employee_id,schedule_date,sector_id'`** com `ignoreDuplicates: true`. Isso elimina race conditions e torna a importação idempotente.
- Mensagem de erro detalhada: se o INSERT ainda falhar, parsear `error.details` e mostrar exatamente qual `(funcionário, data)` conflitou, com botão "Abrir editor para resolver".

#### Frente 4 — Garantir que `sync_schedule_to_freelancer_entry` está protegido
- Verificar a migration anterior; se o trigger não respeita o `ON CONFLICT` da unique, ele pode cascatear erro. Adicionar `ON CONFLICT DO NOTHING` no INSERT do trigger para `freelancer_entries`.

### Arquivos
- **Migration nova**:
  - `merge_duplicate_employees()` + execução por unidade
  - índice único parcial em `employees`
  - revisão do trigger `sync_schedule_to_freelancer_entry` para usar `ON CONFLICT`
- **`src/components/escalas/ScheduleExcelFlow.tsx`**:
  - dedup por nome+data antes da resolução de ID
  - mudar `INSERT` para `upsert({ ignoreDuplicates: true })`
  - mensagem de erro detalhada (lista de conflitos com nome + data)
- **`src/components/escalas/FreelancerAddModal.tsx`**:
  - lookup defensivo por nome antes de inserir
- **`src/lib/scheduleExcel.ts`** (parser):
  - quando 2 employees ativos têm o mesmo nome normalizado, logar warning e escolher o de criação mais antiga (mais provável de ser o correto)

### Validação
- Importar a planilha que está dando erro hoje → deve completar sem erro, mostrando "X linhas unificadas (mesmo funcionário em múltiplos setores)".
- Conferir no banco que cada `(employee, date)` aparece 1× só (no setor principal).
- Tentar reimportar a mesma planilha → 0 inserts, mensagem amigável.
- Tentar criar um 2º funcionário "OBERDAN" sem CPF na mesma loja → bloqueado pelo índice, mensagem "Já existe um funcionário OBERDAN ativo nesta loja".
- Conferir que budget gerencial não duplica entradas após o merge.

### Sem mudanças visuais
A UI continua igual; mudam só as mensagens de erro/sucesso.

