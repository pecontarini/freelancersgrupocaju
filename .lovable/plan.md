## Objetivo

No editor manual de escalas (`ManualScheduleGrid`), permitir que o operador lance freelancers além da cota POP do dia, de forma organizada e sempre visível, sem depender de cliques "escondidos".

## Situação atual

- Existem linhas "VAGA EXTRA" (dentro da cota POP) e "EXTRA AVULSO" (fora da cota).
- O número de linhas extras renderizadas usa `Math.max(quota, filled, 1)`. Quando `filled === quota` (cota cheia), **nenhuma célula vazia aparece** para adicionar um freelancer adicional; o usuário só consegue via botão pequeno "+ Freelancer" no cabeçalho do dia.
- Já existe `FreelancerAddModal` reaproveitável e o botão de cabeçalho.

## Mudanças propostas

1. **Sempre exibir uma vaga avulsa livre por dia**
   - Arquivo: `src/components/escalas/ManualScheduleGrid.tsx`
   - Função `slotsPerDay` (linha ~959): trocar `Math.max(quota, filled, 1)` por `Math.max(quota, filled + 1)`.
   - Resultado: para cada dia, sempre haverá uma célula tracejada "Adicionar freelancer avulso" abaixo das já preenchidas, mesmo após exceder a cota POP. Múltiplos lançamentos extras viram múltiplas linhas, mantendo a grade organizada.

2. **Rótulo dinâmico da linha avulsa**
   - Já existe rótulo `EXTRA AVULSO`. Acrescentar contagem quando passar da cota: `EXTRA AVULSO (N)` onde `N = slotIdx - quotaMax + 1` para deixar claro o nº de extras adicionados além do previsto. Apenas cosmético.

3. **Botão de atalho no cabeçalho do dia**
   - O botão `+ Freelancer` (linha ~1553) já existe e abre o `FreelancerAddModal`. Ajustar `title` para "Adicionar freelancer (inclui acima da cota POP)" e dar destaque visual leve (cor coral/`text-primary`) para reforçar que pode ser usado livremente.

4. **Indicador visual de excedente**
   - No header de métricas do dia, quando `freelancerCountPerDay > extrasQuotaPerDay`, exibir badge discreto "Acima da cota POP (+N)" em âmbar. Ajuda o líder a perceber que está estourando o planejado, sem bloquear.

## Fora do escopo

- Não altera permissões, RLS, regras de orçamento, nem a lógica do `FreelancerAddModal` em si.
- Não muda a cota POP no `staffing_matrix`.

## Verificação

- Abrir editor de escalas em uma semana, escolher setor com cota POP de extras = 1.
- Adicionar 1 freelancer no dia → linha "EXTRA AVULSO" segue exibindo nova célula vazia abaixo.
- Adicionar mais 2 freelancers → grid mostra 3 linhas preenchidas + 1 linha vazia "EXTRA AVULSO (3)".
- Badge "Acima da cota POP (+2)" aparece no cabeçalho do dia.

## Arquivos afetados

- `src/components/escalas/ManualScheduleGrid.tsx` (apenas UI/estado derivado).