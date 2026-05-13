# Roadmap · Painel de Metas Variáveis

## Fase 1 · MVP Visual (entregue 2026-05-13)

**Objetivo:** Liderança vê números no app.
**SSOT:** planilha da Duda.
**Custo Lovable:** baixo.

### Entregas

- `/painel/metas-variaveis` com matriz Loja × Cargo
- KPI strip (payout total, lojas 100%, lojas críticas, colaboradores elegíveis)
- Drill-down de indicadores por colaborador (modal)
- Botão "Sincronizar agora" (4 fontes em paralelo)
- RBAC `operator`/`gerente_unidade` (filtro por loja_code)
- Mobile responsivo (matriz com scroll horizontal, modal full screen)

### Critérios de aceite

- Duda confirma que os números batem com a planilha dela
- Liderança consegue acessar no celular
- Sync manual funciona em <30s

---

## Fase 2 · Automação da Planilha

**Objetivo:** Substituir trabalho mensal manual da Duda.
**Pré-requisitos:** Fase 1 estável por 30 dias.
**Custo Lovable estimado:** ~2 semanas.

### Entregas

- Migration B6/B7: ajustar shapes dos 5 parsers SQL e calibrar `compute_payouts` ≥95% match
- Workflow n8n diário (06:00 + 18:00 BRT)
- Tela `admin/payout-config` (CRUD regras)

### Estado atual da Fase 2 (congelado)

- Match auto vs manual = 67.77% em maio/2026
- NPS Salão/Delivery: 100% (114/114)
- Conformidade: 26 matches / 35 divergências (problema de granularidade por cargo)
- KDS/Budget: 0% (fontes legadas incompletas)

### Critérios de aceite

- `compute_payouts` match ≥95% com cálculo manual da Duda
- n8n rodando 30 dias seguidos sem intervenção
- Duda valida sistema substituindo o trabalho manual

---

## Fase 3 · Migração SSOT

**Objetivo:** Banco como única fonte de verdade.
**Pré-requisitos:** Fase 2 validada por Duda.

### Entregas

- Override manual com justificativa auditável
- Histórico de payouts mensais (`payout_results_monthly` consolidado)
- Planilha vira espelho readonly
- API pra integração com folha de pagamento

---

## Débitos técnicos conhecidos

- `gerente_unidade` sem filtro por cargo (TECH_DEBT.md · Decisão C)
- 9 admins ativos — revisar mensalmente
- 4 CNPJs administrativos não-loja (catalogados em `cnpj_administrativo`)
- KDS payloads legados sem breakdown por loja
- `payout_target_by_role` mistura grafias (`GERENTE DE CPD` vs `Gerente CPD`)
