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
