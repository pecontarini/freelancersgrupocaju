
## Plano Unificado: Refatoracao Completa do Diagnostico de Auditoria

Este plano consolida todas as mudancas pendentes em uma unica implementacao.

---

### 1. Corrigir filtro padrao de periodo

**Problema**: O dashboard usa `this_month` como padrao, escondendo auditorias do mes anterior (como as da Mult 03 em janeiro).

**Solucao**: Alterar o estado inicial de `periodFilter` de `"this_month"` para `"30d"` em `AuditDiagnosticDashboard.tsx`.

---

### 2. Remover aba "Plano de Acao" (legada)

Remover completamente a aba que gerenciava pendencias item a item, ja que tudo agora fica no Diagnostico.

**Arquivos a editar:**
- `src/components/layout/AppSidebar.tsx` - Remover o item `planoacao` do array `menuItems` (linhas 71-75)
- `src/pages/Index.tsx` - Remover:
  - Import do `ActionPlanTab` (linha 16)
  - Entrada `planoacao` do `tabConfig` (linhas 43-46)
  - Case `"planoacao"` do switch (linhas 219-222)

---

### 3. Exibir tipo de checklist no Historico de Auditorias

Mostrar na tabela e no Sheet lateral qual foi o tipo da auditoria (Supervisao, Fiscal, Fiscal CPD, Auditoria de Alimentos).

**Como funciona:**
- Buscar `audit_sector_scores` para os audits do periodo (ja existe a tabela com `checklist_type`)
- Cruzar pelo `audit_id` para descobrir o(s) tipo(s) de cada auditoria
- Exibir como Badge na tabela (nova coluna "Tipo") e no cabecalho do Sheet lateral

**Arquivos a editar:**
- `src/hooks/useSupervisionAudits.ts` - Adicionar query para buscar `audit_sector_scores` e retornar no hook
- `src/components/audit-diagnostic/AuditHistoryTable.tsx` - Adicionar coluna "Tipo" na tabela e badge no Sheet
- `src/components/dashboard/AuditDiagnosticDashboard.tsx` - Passar dados de scores para o componente

---

### 4. Botao de excluir auditoria (apenas admins)

Permitir que administradores excluam uma auditoria duplicada ou incorreta direto pelo Sheet lateral.

**Fluxo:**
1. Usuario admin abre o Sheet de uma auditoria
2. Clica no botao "Excluir Auditoria" (vermelho, no rodape do Sheet)
3. AlertDialog de confirmacao aparece
4. Ao confirmar, o sistema exclui em cascata:
   - `supervision_failures` WHERE audit_id = X
   - `audit_sector_scores` WHERE audit_id = X
   - `supervision_audits` WHERE id = X
5. Invalida queries e fecha o Sheet

**Arquivos a editar:**
- `src/hooks/useSupervisionAudits.ts` - Adicionar mutation `deleteAudit`
- `src/components/audit-diagnostic/AuditHistoryTable.tsx` - Adicionar botao + AlertDialog + logica de exclusao

**Migracao de banco necessaria:**
- A tabela `audit_sector_scores` ja tem policy de ALL para admins, que cobre DELETE
- A tabela `supervision_audits` precisa de uma policy de DELETE para admins (verificar se ja existe)
- A tabela `supervision_failures` ja tem policy de DELETE para admins

---

### Detalhes tecnicos

**Migracao SQL (se necessario):**
```text
-- Garantir que admins podem deletar supervision_audits
CREATE POLICY "Delete supervision_audits admin only"
  ON supervision_audits FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
```

**Hook `useSupervisionAudits.ts` - novas funcionalidades:**
```text
1. Nova query: buscar audit_sector_scores por audit_ids
2. Nova mutation: deleteAudit
   - DELETE supervision_failures WHERE audit_id
   - DELETE audit_sector_scores WHERE audit_id
   - DELETE supervision_audits WHERE id
   - Invalidar queries ["supervision-audits"], ["supervision-failures"]
3. Retornar: auditSectorScores, deleteAudit
```

**`AuditHistoryTable.tsx` - mudancas visuais:**
```text
Tabela:
  | Data | Unidade | Tipo (NOVO) | Nota Final | Falhas | Acao |

Sheet lateral:
  - Badge com tipo no cabecalho (ex: "Supervisao")
  - Botao "Excluir Auditoria" no rodape (apenas admins)
  - AlertDialog de confirmacao antes de excluir

Props adicionais:
  - sectorScores: para resolver o tipo
  - onDeleteAudit: callback de exclusao
  - isAdmin: para mostrar/ocultar botao
```

**Resumo de arquivos editados:**
1. `src/components/dashboard/AuditDiagnosticDashboard.tsx` - Filtro padrao + passar props
2. `src/hooks/useSupervisionAudits.ts` - Query de scores + mutation delete
3. `src/components/audit-diagnostic/AuditHistoryTable.tsx` - Coluna tipo + botao excluir
4. `src/components/layout/AppSidebar.tsx` - Remover item planoacao
5. `src/pages/Index.tsx` - Remover import, config e case do planoacao

**Nenhum componente novo sera criado.** Todas as mudancas sao em arquivos existentes.
