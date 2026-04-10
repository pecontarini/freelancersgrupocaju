
Objetivo: destravar a seleção de lojas e deixar o módulo de Escalas/Quadro Operacional funcional, consistente e rápido.

Diagnóstico confirmado no código:
1. Há 3 fontes de verdade para unidade: `Index.tsx` (estado local), `UnidadeContext.tsx` (contexto) e seletores locais dentro de `ManualScheduleGrid`, `D1ManagementPanel`, `OperationalDashboard` e `TeamManagement`. Elas não estão sincronizadas, então a troca de loja parece “travada”.
2. `UnidadeContext.tsx` faz fallback para a primeira loja quando o usuário multi-loja fica com seleção nula. Isso quebra o significado de “todas as lojas” e gera comportamento inconsistente.
3. Algumas telas de Escalas usam `useConfigLojas()` sem filtrar por perfil, então gestores podem ver listas erradas ou estados vazios.
4. A visão global admin do `OperationalDashboard` está pesada: `AdminGlobalView` monta um card por loja com consultas próprias de setores/matriz/escalas, o que explica congelamento ao abrir “todas as unidades”.

Plano de correção definitiva:
1. Unificar a seleção de unidade no portal
- Trocar `Index.tsx` para usar `useUnidade()` como fonte única de verdade.
- Fazer `PortalHeader` e `UnidadeSelector` escreverem no contexto global.
- Ajustar `UnidadeContext.tsx` para:
  - auto-selecionar só quando o usuário tem 1 loja;
  - manter `null` real para multi-loja quando a escolha for “todas”;
  - diferenciar seleção atual de unidade efetiva.

2. Padronizar todo o módulo Escalas
- `ManualScheduleGrid.tsx`, `D1ManagementPanel.tsx`, `TeamManagement.tsx` e `OperationalDashboard.tsx` passarão a iniciar pela unidade do contexto e só usar override local quando necessário.
- Ao trocar de loja, resetar setor e estados dependentes para evitar tela vazia/travada.
- Nas telas que exigem uma loja concreta, mostrar seletor explícito quando a seleção global estiver em “todas”, em vez de cair silenciosamente na primeira loja.

3. Corrigir visibilidade de lojas por perfil
- Aplicar uma regra única de lojas disponíveis:
  - admin: todas as lojas;
  - operator / gerente_unidade / chefe_setor: apenas lojas vinculadas.
- Usar essa regra em `OperationalDashboard`, `TeamManagement`, `SectorJobTitleMapping`, `StaffingMatrixConfig` e demais seletores locais.

4. Refatorar a visão global admin para performance
- Reescrever `AdminGlobalView.tsx` para usar carregamento agregado em lote, não um conjunto de hooks por card.
- Buscar setores, matriz, escalas do dia e presença uma vez no dashboard e montar os cards por unidade em memória.
- Manter drill-down: clicar no card continua abrindo a unidade detalhada.

5. Validar acesso de dados
- Revisar leitura de `sectors`, `employees`, `staffing_matrix`, `schedules` e `schedule_attendance` para garantir:
  - admin vê tudo;
  - gestores veem apenas suas lojas.
- Se aparecer bloqueio de permissão, complementar as políticas com migração focada.

Arquivos principais impactados:
- `src/pages/Index.tsx`
- `src/contexts/UnidadeContext.tsx`
- `src/components/layout/PortalHeader.tsx`
- `src/components/UnidadeSelector.tsx`
- `src/components/escalas/OperationalDashboard.tsx`
- `src/components/escalas/AdminGlobalView.tsx`
- `src/components/escalas/ManualScheduleGrid.tsx`
- `src/components/escalas/D1ManagementPanel.tsx`
- `src/components/escalas/TeamManagement.tsx`
- `src/components/escalas/SectorJobTitleMapping.tsx`
- `src/components/escalas/StaffingMatrixConfig.tsx`

Resultado esperado:
- Admin consegue abrir qualquer loja e também a visão “todas as unidades” sem congelamento.
- Operator/gerente só veem lojas permitidas e conseguem alternar corretamente.
- O seletor do topo realmente controla o módulo.
- Quadro Operacional, Editor de Escalas, Gestão D-1, Equipe e Configurações passam a responder de forma consistente à loja escolhida.
