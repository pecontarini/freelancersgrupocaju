

User wants to copy an employee's full week schedule to the NEXT week (currently the existing copy is employee→employee in the SAME week, and there's a "copy previous day" but no "copy previous week"). Let me check the current state.
<lov-tool-use id="toolu_vrtx_01H8aWgt3R7B7uoCvUpEi8Lw" name="code--search_files" integration-id="code" data="{\"query\": \"useCopyEmployeeWeek|useCopyPreviousDay|Copiar semana|copyWeek\", \"include_patterns\": \"src/**/*.tsx,src/**/*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_014eyj9z2qykn5Z74Jfu5Ucn" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/**/*.tsx,src/**/*.ts\", \"query\": \"useCopyEmployeeWeek|useCopyPreviousDay|Copiar semana|copyWeek|copy-mode|copyMode\"}">
</lov-tool-use>
The current copy flow copies WITHIN the same week. The user wants to copy to the FOLLOWING week. Let me look at the current state and confirm.
<lov-tool-use id="toolu_vrtx_01KsBm6Q9TX63o7YgxCqNBHe" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/escalas/ManualScheduleGrid.tsx\", \"lines\": \"180-260\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DjVHrzBRyHRwMApJ3v1p4R" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/escalas/ManualScheduleGrid.tsx\", \"lines\": \"1050-1110\"}">
</lov-tool-use>
Now I have full context. The user wants to copy a single employee's schedule to the FOLLOWING WEEK (same employee, next week). Currently the "Copy" feature copies between two employees within the same week, not across weeks. Let me design this clearly.

<lov-plan>

## Plano: Copiar escala do colaborador para a semana seguinte

### Diagnóstico
Hoje no Editor de Escalas existem dois mecanismos:
- **Copiar dia anterior** (botão por dia) — replica todas as escalas do dia X-1 para X
- **Copiar entre colaboradores** (botão `Copy` na linha) — copia da pessoa A para a pessoa B na **mesma semana**

**O que falta:** copiar a escala da própria pessoa para a **semana seguinte** (auto-replicação semana → semana). É o caso mais comum: "essa semana ficou pronta, replica essa pessoa pra próxima".

### O que vou construir

**1. Nova ação por colaborador: "Copiar para próxima semana"**
- Adicionar um segundo ícone na célula sticky do nome do funcionário, ao lado do `Copy` atual: ícone `CopyPlus` (ou `ArrowRightToLine`) com tooltip *"Copiar escala desta semana para a próxima"*
- Ao clicar, abre diálogo de confirmação com:
  - Resumo: *"Copiar X turnos de FULANO da semana DD/MM–DD/MM para DD/MM–DD/MM"*
  - Checkbox "Sobrescrever escalas já existentes na semana destino" (default desligado)
  - Aviso visual se já houver escalas na semana destino (e quantas seriam ignoradas/sobrescritas)
- Ao confirmar, executa cópia e exibe toast com `N escalas copiadas, M ignoradas`

**2. Novo hook `useCopyEmployeeToNextWeek` em `useManualSchedules.ts`**
- Parâmetros: `{ employeeId, sourceWeekStart, sourceWeekEnd, targetWeekStart, sectorIds, overwrite }`
- Lê `schedules` ativos do colaborador na semana origem (em todos os setores acessíveis)
- Calcula offset de 7 dias e gera `target_date = source_date + 7`
- Mantém `sector_id`, `shift_id`, `start_time`, `end_time`, `break_duration`, `praca_id`, `agreed_rate`, `schedule_type`
- Verifica unicidade no destino (por `employee_id + schedule_date + sector_id`):
  - Se existe e `overwrite=false` → pula
  - Se existe e `overwrite=true` → faz UPDATE no registro existente
  - Se não existe → INSERT novo
- Invalida `["manual-schedules"]` e `["schedules"]` para refletir imediatamente
- Retorna `{ copied, skipped }` para o toast

**3. Atalho complementar: "Copiar semana inteira para próxima"**
- Botão extra próximo aos navegadores de semana (apenas para `canManage`): *"Replicar semana atual → próxima"*
- Abre o mesmo diálogo, mas para **todos os colaboradores escalados** desta semana
- Útil quando o gestor terminou a semana e quer só duplicar tudo
- Reusa o mesmo hook iterando por colaborador (ou versão batch `useCopyWeekToNextWeek`)

**4. Fluxo do usuário (cenário principal)**
1. Gestor está na semana 21–27/abr montando escalas
2. Termina a escala da Maria, clica no novo ícone `CopyPlus` na linha dela
3. Confirma → toast: *"7 escalas copiadas para 28/abr–04/mai"*
4. Navega para a próxima semana com o controle existente → vê tudo replicado
5. Pode ajustar pontualmente clicando nas células (modal já existente)

### Arquivos
- **Editar**: `src/hooks/useManualSchedules.ts` — adicionar `useCopyEmployeeToNextWeek` e (opcional) `useCopyWeekToNextWeek`
- **Editar**: `src/components/escalas/ManualScheduleGrid.tsx`:
  - Novo botão `CopyPlus` na linha do funcionário
  - Estado `nextWeekCopyConfirm`
  - Novo `AlertDialog` de confirmação com pré-cálculo de conflitos
  - Botão "Replicar semana → próxima" no header de navegação
- **Sem mudanças** em banco/migrations (constraints já existem) e sem mudanças no `ScheduleEditModal`

### Validação
- Copiar um CLT com 6 dias na semana → próxima semana → todos os 6 dias aparecem nas mesmas datas+7
- Copiar um freelancer com diária definida → mantém `agreed_rate` e cria checkin pendente automaticamente (já tratado pelo upsert via fluxo existente)
- Tentar copiar quando destino já tem escalas → respeita `overwrite=false` (pula) e `overwrite=true` (atualiza)
- Botão "Replicar semana inteira" cobre todos os colaboradores ativos da semana atual

