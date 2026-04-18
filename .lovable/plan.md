

# Plano: Lojas Casadas (Setores Compartilhados)

## Contexto do problema
Operacionalmente existem pares de lojas que compartilham equipe em alguns setores:
- **MULT 03 (Caminito SIG) + NFE 04 (Nazo SIG)** — mesmo prédio
- **MULT 12 (Caminito Águas Claras) + NFE 03 (Nazo Águas Claras)** — mesmo prédio

Nesses casos, **Cozinha, Bar e ASG (Serviços Gerais)** operam com uma equipe única atendendo as duas lojas, mas hoje cada loja tem setores e funcionários isolados — o gerente precisa montar duas escalas separadas e replicar manualmente.

## Solução proposta: "Setor Compartilhado"

Criar um vínculo configurável entre setores de duas lojas. Quando um setor está marcado como compartilhado com o setor equivalente da loja parceira, o Editor de Escalas:
- Mostra **funcionários CLT das duas lojas** na mesma grade
- Salva as escalas no setor da loja escolhida como "principal" (sem duplicar)
- Exibe a escala unificada ao abrir qualquer uma das duas lojas
- Exporta Excel/PDF com a equipe consolidada

A configuração fica na aba **Cargos e Setores** (admin/operador), totalmente opcional — lojas não casadas seguem funcionando como hoje.

## Componentes da solução

### 1. Banco de dados (migration)
Nova tabela `sector_partnerships` que liga dois setores entre si:

```sql
create table sector_partnerships (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references sectors(id) on delete cascade,
  partner_sector_id uuid not null references sectors(id) on delete cascade,
  created_at timestamptz default now(),
  unique(sector_id, partner_sector_id),
  check(sector_id <> partner_sector_id)
);
```

Vínculo bidirecional (ao salvar A↔B, criamos automaticamente B↔A para facilitar leitura). RLS: admin/operador/gerente da loja podem ver/criar; demais leitura.

### 2. Hook `useSectorPartnerships`
- `useSectorPartnerships(sectorIds)` — devolve mapa `sectorId → partnerSectorId | null`
- `useLinkSectors()` / `useUnlinkSectors()` — mutations para criar/remover par

### 3. UI de configuração — `SectorJobTitleMapping.tsx`
Adicionar, ao lado do nome de cada setor, um botão **"🔗 Vincular setor parceiro"**:
- Abre modal com dois selects: **Loja parceira** + **Setor parceiro** (filtra apenas Cozinha/Bar/Serviços Gerais por padrão, mas permite qualquer)
- Se já vinculado: mostra badge "Compartilhado com: NAZO SIG / Cozinha" e botão **Desvincular**
- Confirmação obrigatória: "Esta ação fará a escala deste setor aparecer também na outra loja. Confirmar?"

### 4. Editor de Escalas — `ManualScheduleGrid.tsx`
Quando o setor ativo tem parceiro:
- **Banner azul no topo da grade**: "🔗 Setor compartilhado com NAZO SIG — funcionários das duas lojas aparecem aqui"
- **Lista de funcionários** = união dos CLT das duas lojas (filtrados pelos cargos vinculados ao setor)
- **Coluna extra "Loja"** ao lado do nome do funcionário (badge pequena identificando origem)
- Ao salvar uma escala, ela é gravada no `sector_id` do setor onde o usuário está (não duplica)
- Ao abrir a outra loja parceira, a escala aparece automaticamente porque a query inclui o setor parceiro

### 5. Hook `useEmployees` — modo "loja casada"
Adicionar parâmetro opcional `additionalUnitIds?: string[]`:
- Quando informado, busca funcionários de `unit_id IN [principal, ...adicionais]`
- O `ManualScheduleGrid` calcula `additionalUnitIds` lendo a partnership do setor ativo

### 6. Hook `useManualSchedules` — incluir setores parceiros
Quando carregar schedules, incluir também o `sector_id` parceiro na query `.in("sector_id", [...])`. Os dados já voltam unificados na grade.

### 7. Exports Excel e PDF
`scheduleMasterExport.ts` e `scheduleMasterPdf.ts` — ao montar um setor compartilhado, juntar funcionários das duas lojas e indicar no cabeçalho da página: **"COZINHA — COMPARTILHADO MULT 03 + NFE 04"**.

### 8. Dashboard POP / Quadro Operacional
`usePopCompliance` e `OperationalDashboard` consideram o setor parceiro ao contar pessoas escaladas (evitando "buracos" falsos no POP da outra loja).

## Casos de borda tratados
- **Funcionário em ambas as lojas (CPF duplicado)**: deduplicar por CPF mantendo o mais recente
- **POP da matriz de staffing**: somar `required_count` dos dois setores (admin pode revisar)
- **Importação Excel**: continua por loja; o vínculo só afeta visualização/exibição
- **Remover vínculo**: não apaga escalas — apenas separa as visões novamente
- **Triângulos** (3+ lojas): bloqueado — apenas pares 1:1

## Arquivos

| Tipo | Arquivo |
|------|---------|
| Migration | nova tabela `sector_partnerships` + RLS |
| Criar | `src/hooks/useSectorPartnerships.ts` |
| Criar | `src/components/escalas/SectorPartnerLinkModal.tsx` |
| Editar | `src/components/escalas/SectorJobTitleMapping.tsx` — botão de vínculo |
| Editar | `src/components/escalas/ManualScheduleGrid.tsx` — banner + união de funcionários |
| Editar | `src/hooks/useEmployees.ts` — parâmetro `additionalUnitIds` |
| Editar | `src/hooks/useManualSchedules.ts` — incluir setor parceiro |
| Editar | `src/lib/scheduleMasterExport.ts` — cabeçalho compartilhado |
| Editar | `src/lib/scheduleMasterPdf.ts` — cabeçalho compartilhado |
| Editar | `src/hooks/usePopCompliance.ts` — somar setores parceiros |

## O que NÃO muda
- Estrutura de lojas, setores e funcionários existentes
- Outras lojas (CAJU, FB, MULT 05/14, MULT 02, NFE 01) continuam exatamente como hoje
- Importação Excel, módulos de CMV, Estoque, Utensílios, Agenda
- Schemas das tabelas `employees`, `schedules`, `sectors`

