# Release Notes — Onda 6 / Etapa 2 (Gerador IA + Draft + Publish)

Status: **branch fechado, aguardando merge** (Bloco 2 verde + Onda 2 + Onda 4 antes do go-live).

---

## Comunicação OBRIGATÓRIA antes do go-live

Mensagem visível para sócios e operators (banner no portal + WhatsApp do grupo de gestão):

> **Antes do primeiro publish de escala via Gerador IA, é OBRIGATÓRIO cadastrar seu PIN em Perfil → Segurança.**
>
> Sem PIN cadastrado, override de budget/cota não funciona. Todos os usuários admin/operator foram criados com PIN provisório `0000` marcado para reset obrigatório no primeiro uso.

Sem essa comunicação, o operator vai bater no alerta `must_reset_pin` durante a primeira tentativa de override e abrir chamado de suporte sem saber o que fazer.

---

## Highlights técnicos da Etapa 2

- Novo fluxo `Draft → Validate → Publish` para escalas geradas por IA.
- `publish_schedule_draft` materializa `shifts` virtuais (com `created_from_draft_id` para auditoria; `ON DELETE SET NULL`).
- `validate_schedule_publish` bloqueia infrações CLT (44h, DSR, 11h interjornada, 10h/dia, domingo feminino) e gera warnings consultivos para budget/extras.
- Override de budget/cota exige PIN válido (`verify_user_pin`) — lock de 15 min após 5 falhas.
- Nova página `/perfil/seguranca` para cadastro/troca de PIN.

## Linter

Piso esperado pós-merge: **65 warnings** (3 SECDEF auth-callable arquiteturalmente necessários — ver `TECH_DEBT.md`).
