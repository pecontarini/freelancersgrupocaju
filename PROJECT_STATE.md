# Estado do Projeto — Painel da Lideranca · Modulo de Pessoas

Ultima atualizacao: 2026-05-12

Status geral: pausado aguardando retomada de Pedro Contarini.

## Onde paramos

- Etapa 3 PR 1: COMMITADO em producao, estavel.
- Etapa 2 (Gerador IA): em branch `onda6-etapa2-gerador-ia`, sem deploy.
- Trigger validate_pix_key: em modo PERMISSIVO, gravando em pix_validation_log mas sem bloquear nada.
- AJ1 dos 826 perfis: commitado (migration 20260512111425).
- Documentacao: TECH_DEBT.md, OPERATIONAL_PROTOCOL.md, RELEASE_NOTES_ETAPA2.md, este arquivo.

## O que esta bloqueado aguardando Pedro

1. Bloco 2 — 27 testes manuais nos 3 perfis + fluxo publico. Checklist disponivel no arquivo BLOCO2_CHECKLIST.md.
2. Dump do pix_validation_log das ultimas 24-72h em modo permissivo. Esperado: zero rejeicoes em rejection_reason='other'.
3. Criterio (f) da limpeza (Onda 3): screenshot ou descricao do registro problematico.

## O que vem em sequencia quando Pedro retornar

- Apos Bloco 2 verde + dump do log analisado: virar trigger pra modo ENFORCE.
- Apos enforce: Onda 2 (condicionar trigger sync_schedule + adaptar 10 telas + no-show cron D+1 fuso BR).
- Onda 4 (backfill archived) em paralelo a Onda 2.
- Quando criterio (f) chegar: Onda 3 (limpeza com preview + backup CSV + audit log).
- Apos Etapa 3 estabilizada: merge da Etapa 2 (Gerador IA).

## Prazo maximo do modo permissivo

Trigger nao deve ficar em permissivo por mais que 14 dias apos o COMMIT de 2026-05-12 (Bloco 0 v2.1 + hotfix consume + AJ1). Acima disso, o ganho de observacao ja foi extraido e virar enforce passa a ser prioritario. Se Pedro nao retornar em 14 dias, mandar lembrete proativo.

## Estado do TECH_DEBT.md

Piso de linter atual: 65 warnings. Composicao em TECH_DEBT.md. Nao refatorar pra abaixar.

## Protocolo de execucao

Modo velocidade autorizado: Lovable encadeia PRs seguindo protocolo C1 + DO $verify$ autoabortando, sem precisar de autorizacao individual de Pedro a cada PR. Pedro so intervém nos 4 pontos criticos listados em OPERATIONAL_PROTOCOL.md.

---

## Notas de contexto para retomada rapida

### Estrutura de branches
- `main` / producao: Etapa 3 PR 1 (ajuste trigger + updated_at + AJ1).
- `onda6-etapa2-gerador-ia`: schedule_drafts + schedule_draft_slots + user_pins + publish_schedule_draft + Seguranca.tsx.
- Edge function `gerar-escala-ia`: em branch, sem deploy.

### Tabelas novas (nao em producao ainda)
- `schedule_drafts` — rascunho de escala gerada por IA.
- `schedule_draft_slots` — slots dentro do rascunho.
- `user_pins` — PINs bcrypt com lock de 15min apos 5 falhas.

### Funcoes novas (nao em producao ainda)
- `publish_schedule_draft(p_draft_id, p_override_pin)` — materializa schedules + match-or-create shifts.
- `validate_schedule_publish(p_draft_id)` — valida CLT + budget + extras.
- `verify_user_pin(p_user_id, p_pin)` — valida PIN com lock.
- `set_user_pin(p_pin)` — define PIN com validacao 4-8 digitos.

### Tela nova (nao em producao ainda)
- `/escalas/draft/:draftId` — vinculacao de funcionarios a slots + edicao de diaria + publicacao com PIN.
- `/perfil/seguranca` — cadastro de PIN obrigatorio para operators.

### Seed de PIN
- Todos os admins/operators existentes foram seedados com PIN '0000' e flag must_reset=true.
- Mensagem obrigatoria no RELEASE_NOTES_ETAPA2.md para cadastro antes da primeira publicacao.
