

# Correção: Erro de FK ao substituir setores no importador POP

## Problema

Ao aplicar o POP importado, o sistema tenta **deletar** os setores antigos. Porém, existem 4 tabelas com FK referenciando `sectors`:

- `staffing_matrix` (sector_id)
- `schedules` (sector_id)
- `schedule_attendance` (sector_id, remanejado_de_sector_id, remanejado_para_sector_id)
- `sector_job_titles` (sector_id)

O delete falha porque há registros em `schedules` e `schedule_attendance` vinculados aos setores antigos.

## Solução

**Não deletar setores antigos.** Em vez disso, adotar uma abordagem de **reconciliação**:

1. **Setores que existem na IA e no banco** → manter, apenas atualizar a staffing_matrix
2. **Setores que existem na IA mas não no banco** → criar novos
3. **Setores que existem no banco mas não na IA** → **manter** (não deletar, pois têm escalas vinculadas)
4. **Limpar apenas `staffing_matrix`** dos setores da unidade antes de importar os novos valores

### Mudanças em `StaffingMatrixImporter.tsx`

Reescrever `handleApply`:

1. Buscar setores existentes da unidade
2. Para cada setor extraído pela IA:
   - Se já existe (match por nome normalizado) → usar o ID existente
   - Se não existe → criar via `onAddSector`
3. Deletar todos os registros de `staffing_matrix` dos setores da unidade (isso não tem FK cascade problem)
4. Inserir os novos registros de staffing_matrix via `onUpsert`

Isso elimina a necessidade de deletar setores e preserva o histórico de escalas.

### Mudanças em `StaffingMatrixConfig.tsx`

- Remover `onDeleteSector` do importer (não será mais necessário para importação)
- Adicionar uma nova prop `onClearMatrix` que deleta apenas registros da `staffing_matrix` para os setores da unidade

### Novo: hook ou função para limpar staffing_matrix

Adicionar mutation em `useStaffingMatrix.ts`:
- `useClearStaffingMatrix()` — deleta registros de `staffing_matrix` por lista de `sector_id`s

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/StaffingMatrixImporter.tsx` | Reescrever handleApply (reconciliação sem delete de setores) |
| `src/hooks/useStaffingMatrix.ts` | Adicionar mutation para limpar matrix |
| `src/components/escalas/StaffingMatrixConfig.tsx` | Ajustar props do importer |

