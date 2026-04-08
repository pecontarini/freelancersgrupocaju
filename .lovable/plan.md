

# Plano: Edição de nome de setor + garantir salvamento da importação IA

## Problema atual
1. Não existe botão para editar o nome de um setor existente
2. A importação via IA pode não estar salvando corretamente porque a reconciliação por nome falha quando os nomes não batem exatamente

## Mudanças

### 1. Hook: `useRenameSector` em `src/hooks/useStaffingMatrix.ts`
- Nova mutation que faz `update` no campo `name` da tabela `sectors` pelo `id`
- Invalida queries de `sectors` e `staffing_matrix`

### 2. Botão de edição de nome no `StaffingMatrixConfig.tsx`
- Adicionar ícone de edição (Pencil) ao lado do nome de cada setor na tabela da matriz
- Ao clicar, transforma o nome em um `Input` inline editável
- Ao sair do campo (blur) ou pressionar Enter, salva o novo nome via `useRenameSector`

### 3. Garantir salvamento na importação (`StaffingMatrixImporter.tsx`)
- Na tela de revisão, permitir editar o nome do setor antes de aplicar (para corrigir nomes que a IA leu de forma diferente)
- No `handleApply`, melhorar o fuzzy match: normalizar removendo acentos, espaços extras e caracteres especiais
- Adicionar logs e contadores visuais para confirmar quantos registros foram efetivamente salvos
- Após a criação de setores, usar `await` com re-fetch explícito em vez de `setTimeout` para garantir que os IDs estejam disponíveis

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useStaffingMatrix.ts` | Adicionar `useRenameSector` |
| `src/components/escalas/StaffingMatrixConfig.tsx` | Adicionar botão de edição inline no nome do setor |
| `src/components/escalas/StaffingMatrixImporter.tsx` | Permitir edição de nome na revisão + melhorar reconciliação |

