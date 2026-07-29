## Objetivo

Ao cadastrar previamente um freelancer dentro do Editor de Escalas (modal "Adicionar Freelancer"), permitir enviar para ele — de forma individual e separada — o link de confirmação D-1 (a mesma página pública `/confirm-shift/:id` já usada na Gestão D-1), sem alterar o fluxo atual de cadastro nem a Gestão D-1.

## O que existe hoje (verificado)

- `src/components/escalas/FreelancerAddModal.tsx`: cria o employee (`worker_type: freelancer`), faz upsert do perfil PIX e chama `upsertSchedule` para escalar. Ao terminar, fecha o modal e reseta o formulário.
- `src/components/escalas/D1ManagementPanel.tsx` (linhas 82–97): já monta o link individual `${window.location.origin}/confirm-shift/${schedule.id}` e a URL `wa.me` com mensagem de confirmação — mas só para a lista D-1 do dia seguinte.
- `src/pages/ConfirmShift.tsx`: página pública que lê o agendamento pelo id e registra confirmação/negativa.

## Mudanças propostas

### 1. Helper compartilhado de link D-1
Criar `src/lib/escalas/d1ConfirmLink.ts` com duas funções puras:
- `buildConfirmUrl(scheduleId)` → `${window.location.origin}/confirm-shift/${scheduleId}`
- `buildConfirmWhatsAppLink({ nome, telefone, data, inicio, fim, scheduleId })` → URL `wa.me` com o mesmo texto já usado hoje na Gestão D-1.

Refatorar `D1ManagementPanel.tsx` para usar o helper (mesma mensagem, sem mudança de comportamento).

### 2. Etapa de sucesso no modal de freelancer
Em `FreelancerAddModal.tsx`, após o `upsertSchedule` bem-sucedido, em vez de fechar imediatamente, exibir um passo final compacto dentro do próprio modal:

```text
✔ Freelancer escalado
[Nome] — [dd/MM] [08:00–16:20]

[ Enviar link D-1 no WhatsApp ]   (desabilitado se sem telefone)
[ Copiar link ]                    [ Concluir ]
```

- "Enviar no WhatsApp": abre `wa.me` em nova aba com o link individual.
- "Copiar link": copia a URL para a área de transferência (toast de confirmação).
- "Concluir": fecha o modal e reseta o formulário (comportamento atual).
- Se o freelancer não tiver telefone válido, só o botão de copiar fica ativo, com aviso curto.

Nada muda quando o usuário simplesmente fecha o modal — o cadastro e a escala já foram gravados normalmente.

## Detalhes técnicos

- O passo de sucesso precisa do `id` do registro em `schedules`. Vou confirmar que a mutation `upsertSchedule` (`src/hooks/useManualSchedules.ts`) devolve a linha criada com `id`; se ela hoje não retornar, adiciono `.select("id").single()` no upsert e devolvo o dado na mutation — sem alterar assinatura para os outros consumidores.
- Envio é manual via `wa.me` (mesmo canal já usado na Gestão D-1). Nenhum disparo automático, nenhuma edge function nova, nenhuma alteração de banco.
- `onAdded?.(empId)` continua sendo chamado no momento do sucesso, para a grade atualizar imediatamente mesmo antes de fechar o modal.
- Sem emojis na UI (ícones `lucide-react`: `MessageCircle`, `Copy`, `CheckCircle2`).

## Fora de escopo

- Alterar a mensagem/template do D-1 ou a página `/confirm-shift`.
- Envio automatizado (n8n) ou lembretes agendados.
- Qualquer mudança na Gestão D-1 além da refatoração para o helper compartilhado.
