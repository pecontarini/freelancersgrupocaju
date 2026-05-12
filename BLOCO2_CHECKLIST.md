# Bloco 2 — Checklist de Testes Manuais

27 testes divididos em 4 perfis. Executar em ambiente de producao (modo permissivo) com dados reais. Anexar screenshot + dump de tabela para cada falha.

Ultima atualizacao: 2026-05-12

---

## Setup pre-teste

- 3 contas: `admin@cajupar` (role admin), `operator@cajupar` (vinculado a unidade de teste, role operator), `manager@cajupar` (vinculado a mesma unidade, role gerente_unidade).
- 1 freelancer "BOM" (PIX=CPF, tipo='cpf'), 1 "PENDENTE" (sem tipo_pix), 1 "PROBLEMA" (PIX aleatoria UUID), 1 "TERCEIRO" (PIX = CPF de outra pessoa).

---

## ADMIN — A1 a A10 (10 testes)

| # | Caso | Passos | Resultado esperado | Query de validacao |
|---|------|--------|--------------------|--------------------|
| A1 | Criar freelancer com PIX UUID aleatoria | Admin vai em Cadastros > Novo, preenche chave_pix com UUID v4 | Trigger grava em pix_validation_log com would_reject=true, rejection_reason='other', mas INSERE o registro (modo permissivo) | `SELECT * FROM pix_validation_log WHERE freelancer_id = '...' ORDER BY created_at DESC LIMIT 1;` |
| A2 | Editar PIX de freelancer para CPF de terceiro | Admin edita freelancer "BOM", troca chave_pix para CPF de outro cadastro | Mesmo que A1: log gerado, registro atualizado | `SELECT * FROM pix_validation_log WHERE freelancer_id = '...' AND rejection_reason = 'other';` |
| A3 | Backfill AJ1 — verificar 826 perfis com tipo inferido | Abrir tela Cadastros Pendentes, filtrar por 'cpf' | 826 perfis devem aparecer com tipo_chave_pix='cpf' e status verde | `SELECT COUNT(*) FROM freelancer_profiles WHERE tipo_chave_pix = 'cpf';` |
| A4 | Tela Cadastros Pendentes — contagem total | Abrir Cadastros Pendentes como admin | Contagem de pendentes deve bater com: total - 826 - sem_pix | `SELECT COUNT(*) FROM freelancer_profiles WHERE tipo_chave_pix IS NULL OR tipo_chave_pix = '';` |
| A5 | Magic Link de atualizacao PIX — gerar e enviar | Admin clica "Solicitar atualizacao cadastral" em freelancer PENDENTE | Magic link gerado, status='pending', token preenchido | `SELECT magic_link_token, magic_link_expires_at, status FROM whatsapp_dispatch_queue WHERE freelancer_id = '...' ORDER BY created_at DESC LIMIT 1;` |
| A6 | Visualizar pix_validation_log completo | Admin acessa log de validacao | Ve todas as entradas dos ultimos 7 dias, incluindo would_reject | `SELECT COUNT(*) FROM pix_validation_log WHERE created_at > now() - interval '7 days';` |
| A7 | Cancelar magic link ativo | Admin clica "Cancelar link" em dispatch pendente | Status muda para 'cancelled', consumed_at null | `SELECT status FROM whatsapp_dispatch_queue WHERE id = '...';` |
| A8 | Re-enviar magic link apos cancelamento | Admin clica "Reenviar" no mesmo freelancer | Novo dispatch criado com token diferente, status='pending' | `SELECT COUNT(*) FROM whatsapp_dispatch_queue WHERE freelancer_id = '...' AND status = 'pending';` |
| A9 | Verificar RLS — manager nao acessa Cadastros Pendentes | Tentar abrir /cadastros-pendentes como manager | 403 ou redirect para dashboard | N/A (teste de UI) |
| A10 | Verificar updated_at em bulk update | Admin edita campo observacao em lote | updated_at das linhas afetadas deve refletir timestamp do update | `SELECT updated_at FROM freelancer_profiles WHERE id = '...';` |

---

## OPERATOR — O1 a O4 (4 testes)

| # | Caso | Passos | Resultado esperado | Query de validacao |
|---|------|--------|--------------------|--------------------|
| O1 | Cadastrar freelancer com tipo='telefone' e formato +55... | Operator preenche tipo='telefone', chave='+5511999999999' | pix_validation_log com would_reject=false | `SELECT would_reject FROM pix_validation_log WHERE freelancer_id = '...' ORDER BY created_at DESC LIMIT 1;` |
| O2 | Cadastrar com tipo='email' e regex invalido | Operator preenche tipo='email', chave='nao-e-email' | pix_validation_log com would_reject=true, rejection_reason='invalid_format' | `SELECT rejection_reason FROM pix_validation_log WHERE freelancer_id = '...' ORDER BY created_at DESC LIMIT 1;` |
| O3 | Aprovar lote check-ins de freelancer "PENDENTE" (sem tipo_pix) | Operator vai em Aprovacao de Check-ins, seleciona freelancer PENDENTE, clica "Aprovar lote" | RPC rejeita: mensagem de erro sobre PIX invalido | `SELECT COUNT(*) FROM checkin_budget_entries WHERE freelancer_id = '...' AND created_at > now() - interval '1 hour';` deve retornar 0 |
| O4 | Aprovar lote check-ins de freelancer "BOM" | Mesmo fluxo que O3, mas com freelancer BOM | Sucesso; pix_snapshot populado | `SELECT pix_snapshot FROM checkin_budget_entries WHERE freelancer_id = '...' ORDER BY created_at DESC LIMIT 1;` deve ter tipo, chave, validated_at |

---

## MANAGER — M1 a M4 (4 testes)

| # | Caso | Passos | Resultado esperado | Query de validacao |
|---|------|--------|--------------------|--------------------|
| M1 | Manager tenta editar PIX diretamente | Manager edita freelancer, altera chave_pix | RLS rejeita (403) ou campo read-only | `SELECT COUNT(*) FROM pix_validation_log WHERE triggered_by_user_id = (SELECT id FROM auth.users WHERE email = 'manager@cajupar') AND action = 'update_pix';` deve ser 0 ou erro |
| M2 | Manager solicita atualizacao cadastral | Manager clica "Solicitar atualizacao cadastral" | Flag update_requested_by salva com ID do manager | `SELECT update_requested_by FROM freelancer_profiles WHERE id = '...';` |
| M3 | Manager marca no-show manual (se disponivel) | Manager em CheckinManagerDashboard, clica "Marcar no-show" | Status atualiza para 'no_show', justificativa obrigatoria | `SELECT status, no_show_reason FROM freelancer_checkins WHERE id = '...';` |
| M4 | Manager aprova check-in de freelancer BOM | Manager aprova presenca + valor | Status 'approved', badge atualiza | `SELECT status, approved_by FROM freelancer_checkins WHERE id = '...';` |

---

## FLUXO PUBLICO — P1 a P9 (9 testes)

| # | Caso | Passos | Resultado esperado | Query de validacao |
|---|------|--------|--------------------|--------------------|
| P1 | Magic link peek mascarado (anon) | Abrir link /atualizar-pix?t=TOKEN sem consumir | Payload completo: primeiro_nome, cpf_masked, telefone_masked, tipo_chave_pix, chave_pix_masked, expires_at | N/A (teste via curl/browser anonimo) |
| P2 | Consume magic link (sucesso) | Submeter form com dados validos via link publico | dispatch_responded_at preenchido, status='responded', dados atualizados | `SELECT dispatch_responded_at, status, chave_pix_atualizada FROM whatsapp_dispatch_queue WHERE magic_link_token = '...';` |
| P3 | Consume 2x paralelo | Duas abas simultaneas submetendo o mesmo TOKEN | Exatamente 1 sucesso, 1 erro 'token_already_consumed' | `SELECT COUNT(*) FROM whatsapp_dispatch_queue WHERE magic_link_token = '...' AND status = 'responded';` deve ser 1 |
| P4 | Consume com token expirado | Tentar consumir link com expires_at < now() | Erro 'token_expired' | `SELECT status FROM whatsapp_dispatch_queue WHERE magic_link_token = '...';` deve ser 'expired' ou erro retornado |
| P5 | Peek/consume autenticado como manager | Logar como manager, tentar peek/consume | Erro de privilegio (funcao nao acessivel a authenticated) | N/A (teste de resposta HTTP 403 ou erro de funcao) |
| P6 | Check-in na estacao (publico) | Freelancer acessa /estacao, digita CPF | Check-in registrado, stub pending_schedule criado | `SELECT * FROM freelancer_checkins WHERE cpf = '...' AND created_at > now() - interval '1 hour';` |
| P7 | Check-in de freelancer ja aprovado no dia | Freelancer tenta check-in duplicado no mesmo dia | Erro ou warning de duplicidade | `SELECT COUNT(*) FROM freelancer_checkins WHERE cpf = '...' AND DATE(created_at) = CURRENT_DATE;` |
| P8 | Freelancer consulta status publico | Acessar URL publica de consulta de status | Ve proprio status, horarios, valores (mascarados) | N/A (teste de UI) |
| P9 | Magic link com PIX de terceiro (CPF de outra pessoa) | Freelancer atualiza para CPF ja cadastrado de outro | Trigger loga would_reject=true, mas aceita (permissivo) | `SELECT would_reject, rejection_reason FROM pix_validation_log WHERE freelancer_id = '...' ORDER BY created_at DESC LIMIT 1;` |

---

## Queries de auditoria cruzada

Rodar ao final de cada sessao de teste:

```sql
-- 1. Total de rejeicoes 'other' nas ultimas 24h (deve ser ZERO quando validado)
SELECT COUNT(*) FROM pix_validation_log
WHERE rejection_reason = 'other'
  AND created_at > now() - interval '24 hours';

-- 2. Magic links pendentes nao expirados
SELECT COUNT(*) FROM whatsapp_dispatch_queue
WHERE status = 'pending'
  AND magic_link_expires_at > now();

-- 3. Magic links consumidos nas ultimas 24h
SELECT COUNT(*) FROM whatsapp_dispatch_queue
WHERE status = 'responded'
  AND dispatch_responded_at > now() - interval '24 hours';

-- 4. Freelancers com tipo_chave_pix preenchido (progresso AJ1)
SELECT tipo_chave_pix, COUNT(*) FROM freelancer_profiles
GROUP BY tipo_chave_pix;

-- 5. Checkins orfaos (pending_schedule sem schedule valido)
SELECT COUNT(*) FROM freelancer_checkins fc
LEFT JOIN schedules s ON fc.schedule_id = s.id
WHERE fc.status = 'pending_schedule'
  AND s.id IS NULL;

-- 6. Budget entries criados nas ultimas 24h com pix_snapshot nulo (deve ser ZERO pos-go-live)
SELECT COUNT(*) FROM checkin_budget_entries
WHERE pix_snapshot IS NULL
  AND created_at > now() - interval '24 hours';
```

---

## Criterio de aceite do Bloco 2

Bloco 2 e considerado **VERDE** quando:

1. Todos os 27 testes acima executados com resultado esperado.
2. Query 1 (rejeicoes 'other') retorna ZERO nas ultimas 24h.
3. Nenhum 500, 403 inesperado ou comportamento nao-documentado.
4. Screenshots anexados para cada caso A1, P1, P2, P3, P5, P6 (representativos).
5. Dump das 6 queries de auditoria anexado ao relatorio.

Se qualquer teste falhar, anotar:
- Numero do caso (ex: A3)
- Screenshot da tela
- Resposta exata da API ou mensagem de erro
- Query de validacao que nao bateu

---

## Comunicacao ao final

Ao terminar o Bloco 2, responder neste chat com:
```
Bloco 2 — Resultado: [VERDE / VERMELHO]
Testes passaram: X/27
Falhas detalhadas: [lista ou "nenhuma"]
Dump queries: [anexado ou link]
Screenshots: [anexados ou link]
Autorizo enforce do trigger: [SIM / NAO]
```
