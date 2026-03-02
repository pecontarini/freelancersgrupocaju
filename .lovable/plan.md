

# Correcoes: Budget por Mes Filtrado + Upload de Anexos

## Problema 1: Budget nao acompanha o filtro de mes

**Causa raiz**: Na linha 90 de `BudgetsGerenciaisTab.tsx`, o budget sempre busca o mes atual:
```typescript
const budget = effectiveStoreId
  ? getBudgetForStoreMonth(effectiveStoreId, getCurrentMonthYear())
  : undefined;
```

Quando o usuario filtra para fevereiro, o budget continua mostrando os valores de marco. Precisa derivar o mes do range de datas filtrado.

**Solucao**: Calcular o `month_year` a partir do `effectiveDateRange` e passar para `getBudgetForStoreMonth`.

### Arquivo: `src/components/dashboard/BudgetsGerenciaisTab.tsx`
- Criar um `effectiveMonthYear` derivado do filtro de datas (usando o mes do `start` date do range)
- Substituir `getCurrentMonthYear()` por `effectiveMonthYear` na chamada de budget (linha 90)
- Ajustar os calculos de `monthFreelancerTotal` e `monthMaintenanceTotal` (linhas 214-220) para usar o mes efetivo em vez de `currentMonth`
- Ajustar `daysInMonth` (linha 236) para calcular os dias do mes efetivo

---

## Problema 2: Upload de anexos falha para alguns usuarios

**Causa raiz**: Faltam politicas de UPDATE no bucket `maintenance-attachments`. Quando um arquivo e sobrescrito ou quando certos clientes tentam re-enviar, a operacao falha. Alem disso, o tratamento de erros no upload nao e robusto o suficiente para diagnosticar.

**Solucao**:

### Migration SQL
- Adicionar politica de UPDATE para o bucket `maintenance-attachments` para usuarios autenticados

### Arquivo: `src/components/MaintenanceForm.tsx`
- Melhorar o tratamento de erros no upload para exibir mensagens mais especificas (ex: permissao negada, arquivo invalido)
- Adicionar `upsert: true` na chamada de `supabase.storage.upload()` para ambos os uploads (NF e boleto), evitando conflitos de nome de arquivo
- Garantir que o `accept` do input de arquivo inclua tipos MIME explicitos para melhor compatibilidade mobile

### Arquivo: `src/hooks/useInvoiceExtraction.ts`
- Adicionar timeout e tratamento de erro mais robusto na chamada da edge function para evitar que a extracao trave o fluxo de upload

---

## Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/dashboard/BudgetsGerenciaisTab.tsx` | Editar budget para usar mes do filtro |
| `src/components/MaintenanceForm.tsx` | Melhorar upload com upsert e erros claros |
| `src/hooks/useInvoiceExtraction.ts` | Timeout na extracao |
| Migration SQL | Adicionar UPDATE policy no storage |

