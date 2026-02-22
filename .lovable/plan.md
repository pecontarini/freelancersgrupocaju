
## Plano: Correção Definitiva do Checklist Diário

### Problemas Identificados

1. **Links não vinculados a templates** -- Os links por setor misturam itens de TODOS os templates. Não há como separar checklists por tipo de auditoria (Supervisão, Fiscal, etc.)
2. **Gerentes não podem criar templates** -- O banco permite apenas admin/operator. Gerentes precisam de permissão de escrita
3. **Sem upload de foto obrigatório** -- O campo `photo_url` existe no banco mas a interface não tem funcionalidade de câmera/upload
4. **Respostas não vinculadas a template** -- Impossível ver evolução por tipo de auditoria

### Solução

#### 1. Banco de Dados -- Vincular links e respostas a templates

Adicionar `template_id` nas tabelas `checklist_sector_links` e `checklist_responses` para que cada link seja exclusivo de um template especifico:

```text
checklist_sector_links
  + template_id (uuid, FK -> checklist_templates.id)

checklist_responses  
  + template_id (uuid, FK -> checklist_templates.id)
```

Adicionar RLS para `gerente_unidade` poder criar/editar templates, items e links nas suas unidades.

#### 2. Links separados por Template

**ChecklistLinksPanel** -- Recebe tambem o `templateId` selecionado. Links sao gerados e exibidos POR template, permitindo que cada auditoria (Supervisao, Fiscal) tenha seus proprios links por setor.

**Fluxo no dashboard:**
- Lista de templates com botao "Ver Links" para cada um
- Ao selecionar um template, exibe os links dos setores desse template especifico

#### 3. Foto obrigatória no checklist dos chefes

**DailyChecklist.tsx** -- Adicionar para CADA pergunta:
- Botao de camera/upload de foto (usando o bucket `checklist-photos` ja existente)
- Upload direto para o storage sem autenticacao (bucket publico)
- Validacao: nao permite enviar o checklist se algum item nao tiver foto
- Preview da foto apos upload
- A `photo_url` sera salva no `checklist_response_items`

**Edge function `submit-daily-checklist`** -- Nenhuma mudanca necessaria, ja aceita `photo_url`.

#### 4. Gerentes podem gerenciar templates

Adicionar politicas RLS de escrita para `gerente_unidade` nas tabelas:
- `checklist_templates` -- INSERT/UPDATE/DELETE para suas lojas
- `checklist_template_items` -- INSERT/UPDATE/DELETE para templates das suas lojas
- `checklist_sector_links` -- ALL para suas lojas

#### 5. Dashboard de Respostas por Template

**ChecklistResponsesDashboard** -- Adicionar filtro por template para ver evolucao de cada auditoria separadamente.

### Detalhes Tecnicos

| Arquivo | Mudanca |
|---------|---------|
| **Migracao SQL** | Adicionar `template_id` em `checklist_sector_links` e `checklist_responses`. Criar RLS para gerentes |
| **ChecklistLinksPanel.tsx** | Receber `templateId` prop, filtrar e gerar links por template |
| **ChecklistTemplateList.tsx** | Adicionar botao "Links" por template, expandir para mostrar links do template |
| **DailyChecklist.tsx** | Adicionar upload de foto obrigatoria por item, validacao antes do envio |
| **submit-daily-checklist (edge fn)** | Filtrar itens tambem por `template_id` do link |
| **ChecklistResponsesDashboard.tsx** | Adicionar filtro por template |
| **AuditDiagnosticDashboard.tsx** | Permitir acesso para `operator` e `gerente_unidade` ao painel de templates |

### Upload de Fotos -- Fluxo

1. Chefe tira foto ou seleciona do dispositivo
2. Upload vai para o bucket `checklist-photos` (ja existe, publico)
3. URL publica e salva no estado do componente
4. Ao submeter, `photo_url` e enviada junto com cada resposta
5. **Validacao**: botao "Enviar" so habilita quando TODOS os itens tiverem foto E resposta

### Ordem de Implementacao

1. Migracao SQL (template_id + RLS gerentes)
2. Atualizar edge function para usar template_id
3. Atualizar ChecklistLinksPanel para funcionar por template
4. Adicionar upload de foto no DailyChecklist
5. Atualizar dashboard de respostas com filtro por template
6. Liberar acesso de gerentes no UI
