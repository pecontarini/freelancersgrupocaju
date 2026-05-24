## Diagnóstico (causa raiz)

Investiguei o banco da Caju Limão Asa Norte. O grid de escala está correto, mas o **D-1 lista uma linha por registro em `schedules`**, e a duplicação tem origem em **funcionários cadastrados em duplicidade**. Exemplos confirmados (BAR, 24/05):

| Pessoa | Registros em `employees` | Origem |
|---|---|---|
| Tainara P. Barbosa | 5 (4 manuais + 1 Secullum) | Só 1 tem `secullum_id=5142` |
| Ian Macedo F. da Silva | 3 (2 manuais "(CB)" + 1 Secullum) | Só 1 tem `secullum_id=2176` |
| Davi (de Araujo) Zang | 2 | Só 1 tem `secullum_id=4869` |
| Dayhan Silva de Maceda | 2 | Só 1 tem `secullum_id=3963` |
| Sandher Santos (E Silva) | 3 | Só 1 tem `secullum_id=3084` |

Os apelidos `(CB)` e `(SB)` foram usados pra burlar o pré-check do cadastro rápido.

**Sutileza crítica:** nas duplicatas atuais, as **escalas estão presas aos `employee_id` NÃO-Secullum**. A versão canônica do Secullum existe mas não tem escala vinculada. Portanto **não dá pra simplesmente filtrar "só Secullum"** no D-1 — a pessoa sumiria. Precisamos deduplicar por identidade e **reapontar visualmente** para o registro Secullum.

## Objetivo

1. D-1 mostra **uma única linha por pessoa**, sempre identificada pelo **cadastro vindo do sync Secullum** (nome, CPF, telefone, cargo canônicos).
2. Gestor pode disparar a **fusão definitiva** (move schedules + freelancer_entries + freelancer_checkins dos duplicados pro Secullum e apaga os duplicados), garantindo que o banco fique limpo e o problema não volte.
3. Prevenir novas duplicidades no cadastro rápido.

## Plano

### 1. Dedup com prioridade Secullum no `useD1Schedules`

Arquivo: `src/hooks/useD1Schedules.ts`

- Trazer também `employees.cpf` e `employees.secullum_id` no `select`.
- Buscar todos os `employees` da unidade (uma query auxiliar leve, cacheada) → montar índice de **canônicos Secullum** (`secullum_id IS NOT NULL`) por chave de identidade.
- Chave de identidade (em ordem de prioridade):
  1. `cpf` normalizado (só dígitos), quando existir;
  2. fallback: `normalize(name)` — uppercase, sem acentos, sem espaços extras, sem sufixos entre parênteses (`\s*\([^)]*\)\s*$`), sem primeiro nome solto vs nome completo (heurística: se um nome completo contém o outro, são iguais).
- Agrupar `schedules` por essa chave.
- Para cada grupo, **manter uma única linha** e **rebindar a identidade** (name, phone, job_title, employee_id mostrado) para o canônico Secullum quando existir. Se nenhum membro do grupo for Secullum, mantém o que tem mais info (CPF > telefone > created_at mais novo).
- Critério de horário/status da linha exibida segue prioridade existente (`confirmed` > `denied` > `pending`; depois com `start_time`/`end_time` preenchido; depois mais recente).
- Adicionar `duplicate_count`, `has_secullum_canonical: boolean`, `merged_employee_ids: string[]` no objeto retornado.

Isso resolve o D-1 **imediatamente**, sem mexer em dados.

### 2. Banner + diálogo "Fundir no cadastro Secullum"

Arquivos: `src/components/escalas/D1ManagementPanel.tsx` + novo `D1MergeDuplicatesDialog.tsx`.

- Quando o hook reportar `duplicate_count > 1` em alguma linha, exibir banner no topo: "N pessoas com cadastro duplicado nesta unidade. [Fundir no cadastro Secullum]".
- O diálogo lista cada grupo:
  - **Canônico** (chip "Secullum ✓"): nome + CPF + `secullum_id`.
  - **Duplicados** a serem fundidos: nome, n.º de escalas associadas, data de criação.
  - Se o grupo **não tem canônico Secullum**, mostra aviso "Aguardando próximo sync — fusão indisponível" e desabilita.
- Botão "Fundir N grupos" chama nova RPC `merge_employees_into_secullum(p_unit_id uuid, p_pairs jsonb)`:
  - Para cada par `{keep_id, merge_id}`:
    - `UPDATE schedules SET employee_id=keep_id, user_id=keep_id WHERE employee_id=merge_id` (idem `freelancer_entries`, `freelancer_checkins`, `freelancer_profiles` se houver FK).
    - Tratar conflitos com a constraint única `(employee_id, schedule_date, sector_id)`: se já existir destino, cancelar a duplicada (`status='cancelled'`) em vez de inserir.
    - `DELETE FROM employees WHERE id=merge_id`.
  - Tudo em transação. Retornar contagem de schedules movidos e funcionários apagados.
- Restrito a `canManage` (admin/operador/gerente).

### 3. Endurecer prevenção no `QuickCreateEmployeeModal`

Arquivo: `src/components/escalas/QuickCreateEmployeeModal.tsx`

- Normalizar nome no pré-check (remover sufixo `(...)`, acentos, case).
- Se houver match na unidade e CPF não foi informado, **bloquear** com mensagem: "Já existe '{nome}' nesta unidade (cadastro Secullum: {sim/não}). Informe o CPF ou edite o cadastro existente."
- Se o cadastro existente é Secullum, sugerir reaproveitar diretamente em vez de criar novo.

### 4. (Opcional, decidido após a fusão) Reforçar índice no banco

- Avaliar `CREATE UNIQUE INDEX ON employees (unit_id, cpf) WHERE cpf IS NOT NULL` se ainda não existir, para evitar dois cadastros com mesmo CPF na mesma unidade. (Verifico antes de propor migração.)

## Detalhes técnicos

- A regra "só aceitar valores que vêm do sync Secullum" se traduz em: **a identidade exibida e o registro canônico após fusão é sempre aquele com `secullum_id IS NOT NULL`**. Schedules ficam sob esse `employee_id` único após a fusão.
- Enquanto a fusão não é feita, o D-1 já mostra o nome/telefone/cargo do Secullum graças ao rebind visual do passo 1, mesmo que o `schedule.employee_id` físico ainda aponte pro duplicado.
- Nada muda em `useCopyWeekToNextWeek` — ele continua deduplicando por `employee_id+data+setor`. A causa raiz era duplicidade de pessoas, não de escalas.
- Resumo D-1 copiado pro WhatsApp passa a refletir os números deduplicados.

## Arquivos afetados

- `src/hooks/useD1Schedules.ts` — dedup com prioridade Secullum + rebind visual.
- `src/components/escalas/D1ManagementPanel.tsx` — banner + KPIs deduplicados.
- `src/components/escalas/D1MergeDuplicatesDialog.tsx` (novo).
- `src/components/escalas/QuickCreateEmployeeModal.tsx` — pré-check rígido.
- Migração SQL: `merge_employees_into_secullum(uuid, jsonb)` (SECURITY DEFINER, restrito por RLS via `has_role`).

## Validação

- D-1 Caju Limão Asa Norte deve mostrar 1 linha p/ Tainara, Ian, Davi Zang, Dayhan e Sandher — todas com nome/CPF do Secullum e badge "N registros".
- Após "Fundir N grupos", o banner desaparece, `employees` da unidade fica sem duplicados e `schedules.employee_id` aponta sempre pra registros com `secullum_id`.
- Tentar criar "IAN MACEDO (XX)" no Quick Create sem CPF → bloqueado, com sugestão de usar o cadastro Secullum existente.
