# OPERATIONAL_PROTOCOL — Migrations & Mudanças Sensíveis

Aplica-se a **toda migration de dados** (UPDATE/DELETE em massa, normalização, backfill) das **Etapas 2 e 3** e qualquer mudança que toque mais de 100 linhas em produção.

Schema-only (CREATE TABLE, ADD COLUMN aditivo, CREATE FUNCTION) **não exige** este protocolo — segue direto.

---

## Sequência canônica (sem atalho)

1. **Lovable executa dry-run.**
   `BEGIN; UPDATE …; SELECT count(*) …; ROLLBACK;`
   Se a ferramenta de migração não permitir ROLLBACK controlado, simular via `SELECT` que aplica exatamente os mesmos critérios da query mutadora.

2. **Lovable devolve os counts ao Pedro POR ESCRITO** antes de qualquer COMMIT.
   Devolver: linhas afetadas, breakdown por bucket relevante, conflitos detectados, side-effects esperados (ex.: linhas que cairiam em `pix_validation_log`).

3. **Pedro aprova POR ESCRITO no chat.**
   Texto-livre vale. Aprovação implícita (silêncio, "ok", emoji) **não** vale.

4. **Lovable executa COMMIT.**

5. **Lovable confirma o estado pós-commit com counts equivalentes.**
   Mesma query do dry-run, agora rodada após o COMMIT — counts devem bater. Devolver para Pedro junto com qualquer linha nova em log/auditoria.

---

## Divergência reconhecida (12/05/2026)

No PR 1 da Etapa 3, a AJ1 foi **commitada antes** do passo 2 (devolução escrita dos counts) por um atalho do Lovable. Estado final foi validado depois via 6 queries de verificação e bateu — mas o protocolo foi violado. Daqui em diante, sem exceção.

---

## Decisões técnicas vinculadas

### Magic link de atualização PIX
- **Token opaco** (32 bytes crypto-random base64url) em vez de JWT. Single-use enforçado por `consumed_at`, expiração via `magic_link_expires_at`. Não exige `JWT_SECRET` gerenciado. Revogação = `UPDATE status='cancelled'`.
- Validade: 7 dias.
- Tabela: `whatsapp_dispatch_queue` (campo `magic_link_token`).

### Trigger `validate_pix_key`
- Permanece em **modo permissivo** até autorização escrita explícita do Pedro para virar enforce.
- Modo permissivo = sempre `RETURN NEW`, grava em `pix_validation_log` com `would_reject` e `rejection_reason`.

### Tabelas que NÃO podem ser tocadas sem protocolo
- `freelancer_profiles` (UPDATE em massa)
- `freelancer_entries` (DELETE/UPDATE em massa)
- `checkin_budget_entries` (qualquer UPDATE)
- `freelancer_checkins` (mudança de status em massa)
- `schedules` (UPDATE em massa)

Schema-aditivo nessas mesmas tabelas (ADD COLUMN nullable + default seguro) **é permitido** sem dry-run.

---

## Armadilhas conhecidas do Supabase

### ACL de funções no schema `public` — REVOKE FROM PUBLIC é insuficiente

Default privileges no Supabase concedem `EXECUTE` direto a `anon` **e** `authenticated` em funções criadas no schema `public`. `REVOKE EXECUTE ... FROM PUBLIC` é **insuficiente** para zerar acesso desses roles — sempre revogar explicitamente por role (`REVOKE EXECUTE ... FROM anon, authenticated`) antes de assumir o estado limpo.

Aprendizado do incidente do COMMIT do Bloco 0 v2 (12/05/2026): o `DO $verify$` abortou a transação com erro `anon still has EXECUTE on validate_pix_key` porque o `REVOKE FROM PUBLIC` não removeu o `GRANT` direto que o Supabase mantém por default. Fix: revogar explicitamente de cada role e, quando o acesso anon for desejado, re-grantar logo em seguida.

Pattern canônico para hardening de função no schema `public`:
```sql
REVOKE EXECUTE ON FUNCTION public.fn(...) FROM PUBLIC, anon, authenticated;
-- Se houver fluxo público anônimo legítimo:
GRANT EXECUTE ON FUNCTION public.fn(...) TO anon, service_role;
```

### Validação obrigatória de colunas antes de UPDATE em SECURITY DEFINER

Antes de escrever um `UPDATE table SET col = ...` dentro de uma função `SECURITY DEFINER`, **confirmar via `information_schema.columns`** que cada coluna referenciada existe. CREATE OR REPLACE FUNCTION não valida o corpo contra o schema na hora do CREATE — o erro `column ... does not exist` só aparece em runtime, dentro de uma transação que pode rolar back trabalho legítimo já feito (ex.: o atomic CAS antes do UPDATE problemático).

### REVOKE explícito antes de qualquer GRANT em função nova

Toda função criada no schema `public` deve, **antes** de qualquer `GRANT`, executar:
```sql
REVOKE EXECUTE ON FUNCTION public.fn(...) FROM PUBLIC, anon, authenticated;
```
Só depois aplicar os `GRANT` desejados (`service_role`, `anon` quando público, etc.). Não confiar em "a função é nova, ninguém tem acesso ainda" — default privileges do Supabase já concederam acesso a `anon`/`authenticated` no momento do CREATE. Mesma armadilha do incidente do Bloco 0 v2.

### SECDEF auth-callable é trade-off arquitetural, não dívida

Funções `SECURITY DEFINER` chamáveis por `authenticated` aparecem no linter (rule 0029). **Só refatorar se houver razão de segurança real** (escalada de privilégio comprovada, vazamento de dados de outro tenant, etc.). Refatorar apenas para silenciar o linter quase sempre piora a arquitetura — força o cliente a orquestrar múltiplas RPCs, abre janelas de race condition, complica RLS. Documentar a decisão em `TECH_DEBT.md` como "warning esperado" e seguir.

### Validação de PIN é monopólio de `verify_user_pin`

Toda função/edge/RPC que precise validar PIN do usuário **deve** chamar `public.verify_user_pin(user_id, pin)` e checar o boolean retornado. **Proibido**: validar `length(pin) >= 4`, comparar texto puro com coluna, recriar lógica de lock/contador em outro lugar. `verify_user_pin` centraliza: hash bcrypt, contador `failed_attempts`, lock automático de 15 min após 5 falhas, flag `must_reset`. Qualquer caminho alternativo cria bypass do lock e é falha de segurança.
