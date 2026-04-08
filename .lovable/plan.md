

# Plano: Filtrar freelancers por cargos vinculados ao setor

## Problema

Atualmente o modal de adicionar freelancer lista **todos** os freelancers da unidade, sem filtrar pelo cargo. Isso permite escalar um cumim no bar ou um barman nos cumins.

## Solução

Usar o mapeamento `sector_job_titles` para filtrar a lista de freelancers disponíveis, mostrando apenas aqueles cujo `job_title_id` está vinculado ao setor ativo. No modo "Criar Novo", restringir o campo de cargo a um dropdown com apenas os cargos permitidos.

## Mudanças

### `FreelancerAddModal.tsx`

1. Importar `useSectorJobTitles` e `useJobTitles`
2. Buscar os `job_title_id`s vinculados ao `sectorId` via `useSectorJobTitles([sectorId])`
3. **Modo "Existente"**: filtrar `freelancers` para exibir apenas os que têm `job_title_id` presente nos cargos do setor
4. **Modo "Criar Novo"**: substituir o campo de texto livre "Cargo" por um `Select` dropdown populado apenas com os job titles vinculados ao setor. Ao selecionar, guardar o `job_title_id` para usar no insert
5. No insert de novo freelancer, incluir `job_title_id` além do `job_title` (nome) para garantir consistência futura

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/FreelancerAddModal.tsx` | Filtrar lista + dropdown de cargos do setor |

Nenhuma mudança de banco ou hooks adicionais necessária — os hooks `useSectorJobTitles` e `useJobTitles` já existem.

