# POP Wizard — Assistente IA na Configuração Operacional Holding

## Objetivo
Adicionar um assistente conversacional flutuante dentro de `HoldingOperationalConfigTab` que sugere, valida e ajusta os mínimos de pessoas (`holding_staffing_config`) usando Lovable AI (Gemini 2.5 Pro), com preview revisável antes de publicar.

## Escopo (NÃO mexer em mais nada)
- Edita: `src/components/escalas/HoldingOperationalConfigTab.tsx` (apenas para montar o botão flutuante).
- Cria: 4 arquivos novos de UI/lógica + 1 edge function.
- Reusa hooks existentes: `useHoldingStaffingConfig`, `useUpsertHoldingStaffing`, `useEffectiveHeadcountBySector`.
- Nenhuma alteração de schema. Nenhuma tabela nova.

## Arquivos a criar / editar

### Novos
1. `src/components/escalas/holding/POPWizardButton.tsx`
   - Botão flutuante fixo (bottom-right, `z-40`), ícone `Sparkles`/`Bot` (lucide), estilo liquid-glass coral.
   - Visível apenas quando `unitId` selecionado.

2. `src/components/escalas/holding/POPWizardDrawer.tsx`
   - Drawer lateral direito (vaul `direction="right"`), largura 90vw mobile / 720px desktop.
   - Layout dividido: topo = chat (mensagens + input), base = preview das mudanças sugeridas.
   - Cabeçalho mostra contexto ativo: marca / unidade / mês.
   - Botões: "Aplicar mudanças" (publica via upsert loop) e "Descartar".
   - Estado local (mensagens, sugestões pendentes) — sem store global.

3. `src/components/escalas/holding/POPWizardPreview.tsx`
   - Tabela compacta: setor × dia × turno mostrando `atual → sugerido` para `required_count` e `extras_count`.
   - Diff colorido (verde = aumento, vermelho = redução, azul = novo).
   - Resumo: "X células serão alteradas".

4. `src/hooks/usePOPWizard.ts`
   - Gerencia: histórico de mensagens, envio para edge function, parsing da resposta estruturada (sugestões), aplicação em lote (chama `useUpsertHoldingStaffing` em loop com Promise.allSettled).
   - Modos: `wizard` (sugerir do zero), `validate` (revisar config atual), `adjust` (ajuste livre por linguagem natural).

### Editar
5. `src/components/escalas/HoldingOperationalConfigTab.tsx`
   - Adicionar `<POPWizardButton onClick={...} />` e `<POPWizardDrawer ... />` dentro do bloco `unitId ? (...)` — sem tocar no resto.
   - Passar `brand`, `unitId`, `monthYear` como props.

### Edge Function
6. `supabase/functions/pop-wizard-chat/index.ts`
   - Modelo: `google/gemini-2.5-pro` via Lovable AI Gateway.
   - System prompt embute: regras POP da casa (ler `src/lib/escalas/popRulesText.ts` e replicar lógica), contexto recebido do front (config atual + headcount efetivo + dobras).
   - Streaming SSE token-a-token para o chat.
   - Tool calling estruturado: tool `propose_staffing_changes` com schema `{ changes: [{ sector_key, day_of_week, shift_type, required_count, extras_count, reason }] }`.
   - Trata 429/402 com mensagens claras.
   - `verify_jwt = true` (default). CORS headers padrão.

## Fluxo de uso
```text
[Usuário clica botão flutuante]
       ↓
[Drawer abre — chat vazio + preview vazio]
       ↓
[Usuário digita: "sugira mínimo pra um sábado lotado"]
       ↓
[Front envia: mensagens + contexto (config atual, headcount, dobras, brand, unit, month)]
       ↓
[Edge function → Lovable AI Gemini 2.5 Pro com tool calling]
       ↓
[Stream do texto no chat + tool_call com sugestões estruturadas]
       ↓
[Preview popula com diff atual→sugerido]
       ↓
[Usuário aprova → loop de upsert → invalida queries → painel atualiza]
```

## Detalhes técnicos

### Contexto enviado para a IA (a cada turno)
- Filtros ativos: `brand`, `unitId`, `unitName`, `monthYear`.
- Snapshot da `holding_staffing_config` atual (apenas dessa unidade/mês).
- `effectiveHeadcount` por setor (do hook existente).
- Regras POP em texto (do `popRulesText.ts`).

### Tool schema (resposta estruturada)
```json
{
  "name": "propose_staffing_changes",
  "parameters": {
    "type": "object",
    "properties": {
      "summary": { "type": "string" },
      "changes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "sector_key": { "type": "string" },
            "day_of_week": { "type": "integer", "minimum": 0, "maximum": 6 },
            "shift_type": { "type": "string", "enum": ["almoco", "jantar"] },
            "required_count": { "type": "integer", "minimum": 0 },
            "extras_count": { "type": "integer", "minimum": 0 },
            "reason": { "type": "string" }
          },
          "required": ["sector_key", "day_of_week", "shift_type", "required_count", "extras_count"]
        }
      }
    },
    "required": ["summary", "changes"]
  }
}
```

### Aplicação das mudanças
Loop `Promise.allSettled` chamando `useUpsertHoldingStaffing` para cada item. Toast com sucesso/erro agregado. Invalida `holding_staffing_config` e `staffing_matrix` (já feito pelo hook).

### Tratamento de erro
- Erro de API: toast "Não consegui processar sua solicitação. Tente novamente."
- 429: "Muitas requisições. Aguarde alguns segundos."
- 402: "Créditos de IA esgotados. Adicione créditos em Configurações → Workspace."

## Estilo visual
- Liquid glass coral coerente com o resto do portal (`glass-card`, blur, terracotta `#D05937`).
- Sem emojis na UI (apenas ícones `lucide-react`).
- Loading: typing indicator 3 pontos animados.
- Drawer `z-40` (acima do conteúdo, abaixo de modais Radix `z-50`).

## Fora do escopo
- Persistência do histórico de chat (estado local apenas).
- Aplicação automática sem confirmação humana.
- Mexer em escalas reais (`schedules`) — wizard só configura mínimos.
- Qualquer outra página ou tabela.