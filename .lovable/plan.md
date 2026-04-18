
O usuário precisa de uma forma de vincular duas unidades (lojas casadas) na aba **Configurações**, para que o dimensionamento mínimo (matriz POP) das duas seja tratado como uma unidade só ao subir/configurar.

Hoje já existe `sector_partnerships` (vínculo entre setores). Mas o usuário quer um nível acima: **vínculo entre unidades** — uma "loja casada" no nível da loja, que automaticamente:
1. Marca MULT 12 ↔ NFE 03 e MULT 03 ↔ NFE 04 como unidades parceiras
2. Permite subir a matriz POP única para o par (cobre ambas)
3. Serve de base para criar partnerships de setor automaticamente

Vou propor uma seção nova em **Configurações** chamada "Lojas Casadas" + lógica para a matriz POP cobrir o par.

---

# Plano: Vínculo de Unidades (Lojas Casadas) em Configurações

## 1. Nova tabela: `unit_partnerships`
Migração para criar tabela 1:1 entre unidades (similar à `sector_partnerships`, mas no nível de loja):

```sql
create table unit_partnerships (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references config_lojas(id) on delete cascade,
  partner_unit_id uuid not null references config_lojas(id) on delete cascade,
  created_at timestamptz default now(),
  unique(unit_id, partner_unit_id),
  check(unit_id <> partner_unit_id)
);
```
- Vínculo bidirecional (ao salvar A↔B, criar também B↔A)
- RLS: admin/operador podem criar/remover; demais leitura
- Restrição: cada loja pode ter no máximo **1 parceira**

## 2. Hook `useUnitPartnerships`
- `useUnitPartnerships()` — devolve mapa `unitId → partnerUnitId | null` para todas as lojas
- `useUnitPartner(unitId)` — devolve a unidade parceira de uma específica
- `useLinkUnits()` / `useUnlinkUnits()` — mutations

## 3. Nova seção em Configurações: "Lojas Casadas"
Em `ConfigurationsTab.tsx`, **adicionar componente novo** `UnitPartnershipsSection` (apenas admin/operador):

- Lista todas as lojas com status do vínculo:
  - **Sem parceiro**: botão "🔗 Vincular loja parceira" → modal com select da loja parceira
  - **Com parceiro**: badge "Casada com NFE 03" + botão "Desvincular" (com confirmação por texto "DESVINCULAR")
- Ao vincular, opção checkbox: **"Aplicar automaticamente vínculo nos setores Cozinha, Bar e Serviços Gerais"** (cria as `sector_partnerships` correspondentes em lote)
- Ao desvincular: pergunta se também remove os vínculos de setor associados

## 4. Matriz POP unificada — `StaffingMatrixConfig.tsx`
Quando a loja selecionada tem parceira:
- **Banner no topo**: "🔗 Esta loja está casada com NFE 03. As alterações na matriz POP de setores compartilhados refletem em ambas."
- Para setores que estão em partnership ativa: ao salvar `staffing_matrix`, também espelhar para o `partner_sector_id` (mesmo `required_count` e `extra_count`)
- Para setores sem partnership: comportamento atual (independente)
- Nas linhas do grid, badge pequena "🔗 Compartilhado" identifica visualmente os setores espelhados

## 5. Importador da Matriz — `StaffingMatrixImporter.tsx`
Quando a planilha é importada para uma loja casada:
- Após persistir na loja principal, detectar setores em partnership e replicar automaticamente os valores para o setor parceiro da outra loja
- No modal de confirmação do importador, mostrar contagem: "120 entradas serão criadas (60 nesta loja + 60 espelhadas em NFE 03 - setores compartilhados)"

## 6. Indicador visual em outros locais
- **`UnidadeSelector`**: ao listar lojas casadas, exibir ícone 🔗 ao lado do nome
- **`ConfigSection` de Lojas**: marcar lojas casadas com badge

## Casos de borda
- **Já existe partnership de setor sem partnership de unidade**: continuar funcionando; o vínculo de unidade é "facilitador", não obrigatório
- **Vincular unidades não cria automaticamente partnerships de setor** a menos que o checkbox seja marcado
- **Desvincular unidades não apaga partnerships de setor existentes** (apenas remove o vínculo guarda-chuva)
- **Triângulos**: bloqueados (1:1 apenas)
- **Loja com parceira já definida**: select desabilita lojas que já têm parceira

## Arquivos

| Tipo | Arquivo |
|------|---------|
| Migration | nova tabela `unit_partnerships` + RLS |
| Criar | `src/hooks/useUnitPartnerships.ts` |
| Criar | `src/components/UnitPartnershipsSection.tsx` |
| Criar | `src/components/UnitPartnerLinkModal.tsx` |
| Editar | `src/components/ConfigurationsTab.tsx` — incluir nova seção (admin/operador) |
| Editar | `src/components/escalas/StaffingMatrixConfig.tsx` — banner + espelho ao salvar |
| Editar | `src/components/escalas/StaffingMatrixImporter.tsx` — replicação automática na importação |
| Editar (opcional) | `src/components/UnidadeSelector.tsx` — ícone 🔗 |

## O que NÃO muda
- Estrutura de `config_lojas`, `sectors`, `staffing_matrix`
- Partnerships de setor (`sector_partnerships`) já criadas continuam funcionando
- Editor de Escalas, exports, dashboards (já entendem partnership de setor desde a feature anterior)
- Demais módulos (CMV, Estoque, Utensílios, Agenda)
