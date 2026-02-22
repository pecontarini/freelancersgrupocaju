## Plano: Relatório Setorial + Alertas + Análise IA

### STATUS: ✅ IMPLEMENTADO

---

### PARTE 1: Relatório Setorial com Seleção Múltipla ✅
- `src/components/audit-diagnostic/SectorReportGenerator.tsx` — Criado
- Dialog com checkboxes para múltiplos setores
- PDF com jsPDF + autoTable, uma seção por setor

### PARTE 2: Alertas Automáticos ✅
- Tabela `audit_alerts` criada via migração
- `supabase/functions/generate-audit-alerts/index.ts` — Edge function criada
- `src/components/audit-diagnostic/AlertsFeed.tsx` — Componente criado
- Renderizado acima dos KPIs no dashboard

### PARTE 3: Análise com IA ✅
- `supabase/functions/analyze-audit-patterns/index.ts` — Edge function com Lovable AI (gemini-3-flash-preview)
- `src/components/audit-diagnostic/AIAnalysisButton.tsx` — Componente criado
- Retorna análise estruturada: resumo executivo, padrões, causas raiz, recomendações
