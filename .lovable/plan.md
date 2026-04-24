

## Plano: corrigir lançamento de freelancer no Budget Gerencial

### Diagnóstico (confirmado no banco)

- **Último lançamento manual bem-sucedido**: 23/04 às 15:09. Hoje (24/04): **zero entries** apesar das tentativas dos usuários.
- O trigger novo `trg_create_pending_manual_checkin` (criado ontem) está **ativo** mas **nunca produziu nenhum stub** (`entry_id` em `freelancer_checkins` = 0 registros).
- Como o trigger é `AFTER INSERT` e dispara dentro da transação, **qualquer exception não capturada nele aborta o INSERT em `freelancer_entries`** — é exatamente isso que está bloqueando os usuários.

### Causas técnicas dentro da função `create_pending_manual_checkin()`

1. **INSERT em `freelancer_profiles` sem proteção**: a função busca por CPF normalizado (`regexp_replace`), mas insere com o CPF cru. Se já existir um profile com o mesmo CPF em formato diferente (com pontos vs sem), o UNIQUE `freelancer_profiles_cpf_key` viola → exception → INSERT principal abortado.
2. **Race condition** entre 2 usuários cadastrando o mesmo freelancer simultaneamente: ambos não acham o profile, ambos tentam INSERT, um quebra com unique violation.
3. **Comparação `NEW.data_pop < CURRENT_DATE`** usa `CURRENT_DATE` em UTC do servidor. Lançamentos feitos no fim do dia em São Paulo podem ser interpretados como passado e nem deveriam quebrar (caem no `RETURN NEW` silencioso), mas se algo na lógica anterior quebrar antes, perde-se.
4. **CPF armazenado em `freelancer_entries` ainda vem com pontos** em alguns casos (visto `105.231.131-88` no banco). O frontend já normaliza, mas entries antigos / outros caminhos não.

### O que vou implementar

#### 1. Tornar o trigger 100% à prova de falha (nunca bloquear o INSERT principal)

Reescrever `create_pending_manual_checkin()` envolvendo **todo** o corpo em `BEGIN ... EXCEPTION WHEN others THEN RAISE WARNING ... RETURN NEW; END;`. Assim, se qualquer coisa der errado na criação do stub de check-in, o lançamento manual no Budget continua funcionando normalmente — o stub é "best effort".

#### 2. Corrigir o INSERT em `freelancer_profiles`

- Sempre usar **CPF normalizado** (apenas dígitos) no INSERT, igual ao que já é usado na busca.
- Trocar o INSERT por `INSERT ... ON CONFLICT (cpf) DO UPDATE SET nome_completo = COALESCE(freelancer_profiles.nome_completo, EXCLUDED.nome_completo) RETURNING id` para eliminar race condition e conflito de formato.

#### 3. Mesma blindagem em `create_pending_schedule_checkin()` e `sync_schedule_to_freelancer_entry()`

Aplicar o mesmo padrão (BEGIN/EXCEPTION cobrindo a função inteira) nas outras 2 funções que escrevem em tabelas dependentes a partir de `schedules`. Hoje elas já têm EXCEPTION em alguns trechos, mas não em todos — vou padronizar para que **nenhum trigger acessório possa derrubar uma operação principal**.

#### 4. Normalizar CPF no `useFreelancerEntries.ts` (defesa em profundidade)

Hoje o hook já tenta limpar o CPF antes de gravar, mas só se tiver exatamente 11 dígitos. Vou ajustar para **sempre** salvar apenas dígitos em `freelancer_entries.cpf`, mesmo se vier mascarado, garantindo consistência com `freelancer_profiles.cpf` e com o matching do check-in.

#### 5. Verificação final no `FreelancerForm.tsx`

Conferir se o submit não está bloqueando por algum erro de validação silencioso (Zod / loading state preso). Pelo que vi no código, está OK, mas vou validar e ajustar só se preciso.

### Mudanças técnicas

| Arquivo / objeto | Mudança |
|---|---|
| Migração SQL | `CREATE OR REPLACE FUNCTION create_pending_manual_checkin()` blindada (BEGIN/EXCEPTION envolve tudo, INSERT em profiles com `ON CONFLICT (cpf) DO UPDATE`, CPF normalizado) |
| Migração SQL | `CREATE OR REPLACE FUNCTION create_pending_schedule_checkin()` com mesma blindagem total |
| Migração SQL | `CREATE OR REPLACE FUNCTION sync_schedule_to_freelancer_entry()` com mesma blindagem total |
| Migração SQL (data fix) | `UPDATE freelancer_entries SET cpf = regexp_replace(cpf, '\D', '', 'g') WHERE cpf ~ '\D'` para padronizar histórico |
| `src/hooks/useFreelancerEntries.ts` | Sempre gravar CPF apenas com dígitos (independente do tamanho) |

### Resultado esperado

- Lançamento manual no Budget Gerencial volta a funcionar 100%, mesmo em casos de conflito de profile, CPF duplicado ou outras edge cases dos triggers.
- Editor de Escalas continua criando entries provisórios e cards "Aguardando" como hoje.
- Estação de check-in (tablet) continua enxergando os mesmos stubs.
- Histórico de CPFs fica padronizado (só dígitos), facilitando matching futuro.

### Validação

1. Abrir formulário de Budget Gerencial → lançar freelancer com CPF novo → ver entry salva e card "Aguardando" aparecer no tablet/Presença.
2. Lançar 2x o mesmo CPF para o mesmo dia → segundo não duplica stub, primeiro segue funcional.
3. Lançar entry com data passada → entry salva normal, **sem** criar stub (correto).
4. Editar valor de uma entry manual → stub atualiza `valor_informado`.
5. Excluir entry manual → stub de check-in correspondente some.
6. Conferir no banco que `freelancer_entries.cpf` agora só tem dígitos.

