
Objetivo: fazer o vínculo de setores realmente funcionar e fazer os dois lados aparecerem juntos no Editor de Escalas.

Diagnóstico
- Pelo print, o bloqueio imediato é este: a loja parceira selecionada não tem setores cadastrados, então o modal fica sem opção de “setor parceiro” e o vínculo não pode ser concluído.
- No código, mesmo quando existe `sector_partnership`, o Editor de Escalas ainda mistura só uma parte dos dados:
  - traz funcionários da loja parceira,
  - mas continua filtrando escalas, métricas, quadro base e edição principalmente pelo `activeSectorId` local.
- Resultado: o setor pode até ficar “vinculado”, mas não vira de fato uma área única na elaboração da escala.

Plano de correção

1. Corrigir o fluxo de vínculo de setor
- Ajustar `SectorPartnerLinkModal` para não parar em beco sem saída quando a loja parceira estiver sem setores.
- Quando não existir setor correspondente na loja parceira, mostrar ação para:
  - criar o setor parceiro automaticamente, usando o nome do setor atual, e
  - já concluir o vínculo na sequência.
- Melhorar o texto do modal para deixar claro que, sem setor cadastrado na loja parceira, não há como unificar a escala.

2. Fazer o Editor de Escalas operar com “setor efetivo compartilhado”
- Em `ManualScheduleGrid`, calcular `effectiveSectorIds = [setorAtual + setorParceiro]` quando houver parceria.
- Usar esses ids combinados em toda a leitura da tela:
  - escalas da semana,
  - funcionários já escalados,
  - métricas diárias,
  - contagem de freelancers,
  - badges e indicadores do POP,
  - quadro base do setor.

3. Mostrar as duas equipes juntas de verdade
- Unir a base de funcionários das duas lojas no setor compartilhado.
- Considerar também os cargos vinculados dos dois setores, para o “Quadro base do setor” trazer CLTs dos dois lados, não só os já escalados.
- Manter a identificação visual de quem pertence à loja parceira.

4. Salvar novas escalas no setor correto
- Hoje novas escalas tendem a usar o setor local por padrão.
- Ajustar para que, em setor compartilhado:
  - funcionário da loja atual grave no setor atual,
  - funcionário da loja parceira grave no setor parceiro,
  - edição de uma escala existente continue respeitando o `sector_id` original.
- Isso evita mistura errada de dados e mantém cada loja com seus próprios registros, mesmo na visão unificada.

5. Ajustar o fluxo de freelancer no setor compartilhado
- Revisar `FreelancerAddModal`, porque hoje ele abre usando só a loja/setor local.
- Em setor compartilhado, incluir escolha do lado correto (loja atual ou parceira) antes de lançar o freelancer.

Arquivos principais
- `src/components/escalas/SectorPartnerLinkModal.tsx`
- `src/components/escalas/SectorJobTitleMapping.tsx`
- `src/components/escalas/ManualScheduleGrid.tsx`
- `src/components/escalas/FreelancerAddModal.tsx`
- `src/hooks/useSectorPartnerships.ts`
- possivelmente um helper novo para resolver “setor compartilhado efetivo”

Impacto técnico
- Não precisa de nova tabela.
- A correção é principalmente de fluxo e leitura/escrita consistente sobre `sector_partnerships`.
- O foco é transformar o vínculo em comportamento operacional real, não só em badge visual.

Resultado esperado
- Se a loja parceira estiver vazia, você conseguirá criar o setor parceiro e vincular no mesmo fluxo.
- Depois de vinculado, Cozinha/Bar/ASG aparecerão como uma única frente operacional no Editor de Escalas.
- Funcionários e escalas das duas lojas ficarão juntos na elaboração, mas cada lançamento continuará salvo no setor correto de origem.

Validação que farei na implementação
- Vincular MULT 12 ↔ NFE 03 em um setor compartilhado.
- Garantir que o modal permita concluir o vínculo mesmo se a loja parceira estiver sem setor.
- Confirmar que, no Editor de Escalas, aparecem juntos:
  - funcionários da loja atual,
  - funcionários da loja parceira,
  - escalas já lançadas dos dois lados,
  - quadro base e indicadores coerentes.
