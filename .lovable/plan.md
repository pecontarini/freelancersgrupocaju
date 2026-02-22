

## Plano Atualizado: Relatorio Setorial + Alertas + Analise IA (sem Plano de Acao no PDF)

Removemos o espaco de "Plano de Acao" e assinaturas do PDF setorial. O relatorio fica mais direto: cabecalho, resumo, tabela de falhas e pronto.

---

### PARTE 1: Relatorio Setorial com Selecao Multipla

**UI/UX**:
- Novo botao "Relatorio por Setor" no header do Diagnostico
- Dialog com checkboxes listando setores que possuem falhas (com contagem)
- Setores sem falhas ficam desabilitados
- Botoes "Selecionar Todos" / "Limpar" + "Gerar PDF"
- PDF gerado com jsPDF + autoTable, uma secao por setor

**Estrutura do PDF (por setor)**:
```text
[Logo] RELATORIO SETORIAL - [NOME DO SETOR]
Unidade: [LOJA] | Periodo: [DATAS]
Chefe: [CARGO RESPONSAVEL]

Apontamentos: X | Recorrentes: Y

| # | Item | Detalhes | Recorrente? |
| 1 | ...  | ...      | Sim (3x)    |

--- quebra de pagina para proximo setor ---
```

Sem espaco de plano de acao, sem assinaturas. Direto ao ponto.

**Arquivos**:
- **Novo**: `src/components/audit-diagnostic/SectorReportGenerator.tsx`
- **Editar**: `src/components/audit-diagnostic/index.ts` (adicionar export)
- **Editar**: `src/components/dashboard/AuditDiagnosticDashboard.tsx` (importar e renderizar no header)

---

### PARTE 2: Alertas Automaticos

**UI/UX**:
- Card compacto "Alertas" acima dos KPIs quando houver alertas nao lidos
- Feed com alertas organizados por severidade:
  - Vermelho: auditoria abaixo de 70%
  - Laranja: item recorrente (3+ vezes em 60 dias)
  - Amarelo: plano de acao vencendo em 24h
- Botao de acao rapida em cada alerta ("Ver Auditoria")
- Marca como lido ao clicar

**Implementacao**:
- **Migracao**: Criar tabela `audit_alerts` com campos: id, loja_id, alert_type, severity, title, description, reference_id, is_read, created_at
- RLS: admins veem todos, gerentes veem de suas lojas
- **Nova Edge Function**: `generate-audit-alerts` - verifica condicoes criticas e insere alertas
- **Novo**: `src/components/audit-diagnostic/AlertsFeed.tsx`
- **Editar**: `src/components/dashboard/AuditDiagnosticDashboard.tsx` (renderizar AlertsFeed)

---

### PARTE 3: Analise com IA

**UI/UX**:
- Botao "Analisar com IA" (icone Sparkles) no header do Diagnostico
- Ao clicar, envia falhas do periodo para a IA
- Dialog com resultado formatado:
  1. Resumo Executivo (2-3 paragrafos)
  2. Padroes Identificados
  3. Causas Raiz Sugeridas
  4. Recomendacoes priorizadas
- Botoes "Copiar" e "Imprimir"
- Loading animado: "Analisando X falhas em Y setores..."

**Implementacao**:
- **Nova Edge Function**: `analyze-audit-patterns` usando Lovable AI (gemini-2.5-flash)
- **Novo**: `src/components/audit-diagnostic/AIAnalysisButton.tsx`
- **Editar**: `src/components/audit-diagnostic/index.ts` (export)
- **Editar**: `src/components/dashboard/AuditDiagnosticDashboard.tsx` (renderizar)

---

### Resumo de arquivos

| Arquivo | Acao | Parte |
|---------|------|-------|
| `src/components/audit-diagnostic/SectorReportGenerator.tsx` | Novo | 1 |
| `src/components/audit-diagnostic/AIAnalysisButton.tsx` | Novo | 3 |
| `src/components/audit-diagnostic/AlertsFeed.tsx` | Novo | 2 |
| `src/components/audit-diagnostic/index.ts` | Editar | 1,2,3 |
| `src/components/dashboard/AuditDiagnosticDashboard.tsx` | Editar | 1,2,3 |
| `supabase/functions/generate-audit-alerts/index.ts` | Novo | 2 |
| `supabase/functions/analyze-audit-patterns/index.ts` | Novo | 3 |
| Migracao: tabela `audit_alerts` | Novo | 2 |

### Ordem de implementacao
1. Relatorio Setorial (impacto imediato, sem dependencia de banco)
2. Analise IA (alto valor, sem migracao)
3. Alertas Automaticos (requer migracao + edge function)

