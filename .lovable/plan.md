

# Problema e Correção: Fluxo de Aprovação → Budget

## Como funciona o fluxo (na prática)

O processo tem **3 etapas obrigatórias** para um check-in virar lançamento no budget:

1. **Aprovar Presença** — gestor clica "Aprovar Presença" no card (compara selfie com foto cadastro)
2. **Confirmar Valor** — gestor clica "Confirmar Valor" e define o R$ aprovado
3. **Assinar com PIN** — gestor digita um PIN para assinar o lote → isso dispara a função `promote_approved_checkins` que cria o registro em `checkin_budget_entries`

**Sem a etapa 3 (PIN), nada sobe para o budget.**

## O Bug

O card "Assinatura em Lote" (etapa 3) **desaparece** após a etapa 1. Isso acontece porque:

- O card só aparece quando `pendingCount > 0`
- `pendingCount` conta checkins com `status === "completed"`
- Após aprovar a presença, o status muda para `"approved"` → `pendingCount` cai para 0 → card some

O gestor fica preso: aprovou presença, confirmou valor, mas não tem onde digitar o PIN.

## Correção

### `src/components/checkin/CheckinManagerDashboard.tsx`

Adicionar uma nova variável `readyToSign` que filtra checkins com **ambas** as aprovações completas (`status === "approved"` E `valor_status === "approved"`), e mostrar o `CheckinBatchApproval` quando houver registros prontos para assinar.

```text
Antes:  pendingCount > 0 → mostra batch (filtra status="completed")
Depois: readyToSign.length > 0 → mostra batch (filtra status="approved" + valor_status="approved")
```

| Arquivo | Mudança |
|---------|---------|
| `src/components/checkin/CheckinManagerDashboard.tsx` | Corrigir condição e filtro do CheckinBatchApproval |

