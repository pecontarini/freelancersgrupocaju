
Objetivo: fazer a opção de vincular unidades aparecer no lugar certo para o fluxo operacional e corrigir a inconsistência de acesso.

Diagnóstico do problema
- O vínculo de unidades já existe no código, mas foi colocado em `Configurações` do menu administrativo (`ConfigurationsTab`).
- No uso real, você está em `Escalas > Configurações` (`StaffingMatrixConfig`), então a ação “não aparece” onde a operação espera encontrá-la.
- Há também uma inconsistência de permissão: `UnitPartnershipsSection` aceita admin/operador, mas o tab `configuracoes` da página principal só renderiza para admin.

Plano de correção
1. Mover o ponto principal de uso para Escalas
- Inserir a seção `Lojas Casadas` dentro de `src/components/escalas/StaffingMatrixConfig.tsx`, acima do seletor de unidade.
- Isso coloca o vínculo exatamente no fluxo onde o usuário sobe a matriz POP conjunta.

2. Manter consistência sem quebrar o que já existe
- Decidir uma das abordagens:
  - Preferida: exibir `Lojas Casadas` também em `Escalas > Configurações` e manter no menu administrativo.
  - Alternativa: remover do menu administrativo e deixar apenas em Escalas.
- Eu seguiria com a primeira, porque evita regressão para quem já procurar em Configurações.

3. Corrigir regra de acesso
- Revisar `src/pages/Index.tsx` e `src/components/layout/AppSidebar.tsx` para alinhar permissões.
- Se o recurso é admin + operador, o acesso visual e o render precisam seguir a mesma regra em todos os lugares.

4. Ajustar UX para ficar claro
- Dentro de `StaffingMatrixConfig`, posicionar:
  - card “Lojas Casadas”
  - depois seletor da unidade
  - depois banner da loja parceira e a matriz
- Assim o usuário primeiro vincula as lojas e depois já configura a matriz unificada.

5. Hardening de estado/carregamento
- Garantir que a renderização da seção espere o carregamento de perfil/permissões antes de decidir esconder/exibir.
- Isso evita sumiço temporário por loading de role.

Arquivos a ajustar
- `src/components/escalas/StaffingMatrixConfig.tsx` — adicionar a seção `Lojas Casadas` no fluxo de Escalas
- `src/components/ConfigurationsTab.tsx` — manter ou simplificar a versão administrativa
- `src/pages/Index.tsx` — alinhar render do tab `configuracoes`
- `src/components/layout/AppSidebar.tsx` — alinhar visibilidade do menu com a mesma regra de permissão
- Opcional: `src/hooks/useUserProfile.ts` — usar/loading guard de forma explícita no consumo

Resultado esperado
- Em `Escalas > Configurações`, a opção “Lojas Casadas” aparece antes da matriz.
- O usuário consegue vincular MULT 12 ↔ NFE 03 e MULT 03 ↔ NFE 04 sem sair do módulo de Escalas.
- O vínculo passa a ficar no ponto natural do processo de dimensionamento mínimo, reduzindo erro operacional e confusão de navegação.
