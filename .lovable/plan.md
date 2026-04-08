
Objetivo
- Fazer o POP lido pela IA salvar de forma confiável e aparecer corretamente em todas as telas.

Diagnóstico confirmado
- A gravação não está simplesmente “falhando”: os dados chegam ao backend, mas parte deles está sendo salva com o turno vindo cru da IA (`ALMOÇO`, `JANTAR`), enquanto o restante do sistema lê apenas os valores internos (`almoco`, `jantar`).
- Também existe inconsistência no `day_of_week`: uma parte do app usa 0=segunda…6=domingo e outra usa `Date.getDay()` (0=domingo).
- O mês selecionado no importador hoje não é persistido; ele só aparece na interface.

Plano
1. Canonizar o payload da IA antes de salvar
   - Converter qualquer turno lido pela IA para um valor interno único.
   - Normalizar nomes de setores para reconciliação confiável.
   - Se houver turno ambíguo, permitir correção na etapa de revisão.

2. Trocar o fluxo atual por um “aplicar POP” único no backend
   - Em vez de vários `upsert`s no client, usar uma única operação transacional.
   - Essa operação vai: reconciliar/criar setores, preservar setores com histórico, limpar apenas a matriz da unidade e gravar toda a nova matriz em lote.
   - Remover dependência de `setTimeout` e passar a usar retorno real da operação.

3. Confirmar o salvamento antes de fechar o modal
   - Rebuscar a matriz após aplicar.
   - Comparar “linhas esperadas” x “linhas gravadas”.
   - Só concluir com sucesso se o total salvo bater com o total interpretado.

4. Padronizar todos os leitores do POP
   - Ajustar matriz, editor de escalas, mobile, dashboard operacional, compliance e exportações para usar a mesma convenção de turno e dia.
   - Isso elimina o efeito “salvou no banco, mas não aparece na tela”.

5. Persistir o mês de referência
   - O mês escolhido no importador passará a ser salvo junto da importação.
   - Se você quiser manter histórico mensal real do POP, essa mesma refatoração já pode deixar a base pronta para isso.

Detalhes técnicos
- Importação e revisão: `src/components/escalas/StaffingMatrixImporter.tsx`
- Configuração e integração: `src/components/escalas/StaffingMatrixConfig.tsx`
- Hooks de gravação/leitura: `src/hooks/useStaffingMatrix.ts`
- Leituras que precisam ser padronizadas: `ManualScheduleGrid.tsx`, `MobileScheduler.tsx`, `WeeklyScheduler.tsx`, `OperationalDashboard.tsx`, `usePopCompliance.ts`, `scheduleMasterExport.ts`, `scheduleMasterPdf.ts`
- Backend: criar uma operação transacional para aplicar o POP completo com validação e retorno resumido

Resultado esperado
- O que a IA interpretar será exatamente o que ficará salvo.
- Os mesmos números aparecerão na matriz, no editor de escalas, no dashboard e nas exportações.
- O processo deixa de ser frágil e passa a ser previsível, verificável e auditável.
