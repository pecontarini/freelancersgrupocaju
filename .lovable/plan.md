

## Plano: Adicionar opcao N/A (Nao Se Aplica) ao Checklist Diario

### Objetivo

Permitir que o aplicador marque itens como "N/A" (nao se aplica). Quando um item e marcado como N/A, seu peso e removido do calculo — redistribuindo-se proporcionalmente entre os demais itens respondidos como SIM ou NAO.

### Logica de calculo

O calculo atual soma os pesos dos itens conformes e divide pelo total de pesos. Com N/A, os itens marcados como N/A simplesmente saem do calculo:

```text
Antes:  score = SUM(peso_conformes) / SUM(peso_todos) * 100
Depois: score = SUM(peso_conformes) / SUM(peso_todos - peso_NA) * 100
```

Exemplo: 10 itens de peso 1. Se 7 SIM, 2 NAO, 1 N/A:
- Sem N/A: 7/10 = 70%
- Com N/A: 7/9 = 77.8% (o item N/A sai do denominador)

### Mudancas

**1. Frontend — `src/pages/DailyChecklist.tsx`**

- Adicionar um terceiro estado ao `ItemResponse.is_conforming`: `true` (SIM), `false` (NAO), `null` (nao respondido), e um novo campo `is_na: boolean`
- Adicionar botao "N/A" ao lado de SIM/NAO com estilo cinza/neutro
- Quando N/A e marcado:
  - Nao exigir observacao nem foto
  - Recolher o painel de observacao se estava aberto
  - Contar como "respondido" no progresso
- Atualizar `answeredCount` para contar itens com `is_conforming !== null || is_na === true`
- Atualizar `canSubmit` para considerar itens N/A como respondidos
- Atualizar o PDF: itens N/A aparecem com status "N/A" na tabela e nao contam na capa (indicadores ajustados)
- Na tela de resultado, mostrar contagem de N/A separadamente

**2. Backend — `supabase/functions/submit-daily-checklist/index.ts`**

- Aceitar `is_na: boolean` no payload de cada resposta
- No calculo do score, excluir itens com `is_na === true` do `totalWeight`
- Ajustar `total_items` para refletir apenas itens efetivamente avaliados (sem N/A)
- Salvar `is_na` na tabela `checklist_response_items`

**3. Banco de dados — Migracao SQL**

- Adicionar coluna `is_na boolean NOT NULL DEFAULT false` na tabela `checklist_response_items`

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | `ALTER TABLE checklist_response_items ADD COLUMN is_na boolean NOT NULL DEFAULT false` |
| `supabase/functions/submit-daily-checklist/index.ts` | Excluir itens N/A do calculo de score; salvar `is_na` no insert |
| `src/pages/DailyChecklist.tsx` | Novo botao N/A, nova logica de progresso/validacao, ajuste do PDF e tela de resultado |

### Fluxo do usuario

1. Abre o checklist e ve os itens com tres opcoes: **SIM**, **NAO**, **N/A**
2. Marca um item como N/A — o item fica com visual cinza e nao pede foto/observacao
3. O progresso conta o item como respondido
4. Ao submeter, o backend calcula a nota ignorando os pesos dos itens N/A
5. O PDF mostra "N/A" na coluna de status e os indicadores da capa refletem a contagem correta

