## Objetivo

Estender o POP Wizard para que o COO anexe **um único POP** (PDF, imagem, Excel ou texto) e a IA gere automaticamente a proposta de Tabela Mínima para **todas as unidades operacionais** (Caju Limão, Caminito, Nazo, Foster's Burguer) de uma vez. A revisão final acontece em um diff por unidade, com Aplicar/Descartar individuais.

## Como vai funcionar (visão do usuário)

1. No POP Wizard, o COO clica em **"Anexar POP global"** e seleciona o arquivo.
2. Aparece uma faixa de seleção das unidades-alvo (todas marcadas por padrão), com contagem (ex.: "12 unidades selecionadas").
3. Clica em **"Aplicar a todas as unidades"** — a IA processa cada unidade em paralelo.
4. A tela mostra um **acordeão de propostas por unidade**, cada uma com:
   - Resumo da IA (setores cobertos, células inferidas, alertas)
   - Tabela de diffs (atual → proposto) por setor/dia/turno
   - Botões **Aplicar nesta unidade** e **Descartar**
   - Status: pendente, aplicada, com erro
5. Botão global **"Aplicar em todas pendentes"** para o COO confirmar de uma vez no final.

## Arquitetura

```text
POPWizardDrawer (UI)
   └─ aba "Multi-unidade"  ← novo
        ├─ Anexo único + lista de unidades-alvo
        ├─ Botão "Aplicar a todas"
        └─ Lista <UnitProposalCard /> por unidade
              ├─ usePOPWizardBatch (novo hook)
              └─ chama pop-wizard-chat (existente)
                  passando context.unitId/brand/setores/efetivo
                  por unidade, em paralelo (concurrency 3)
```

A edge function `pop-wizard-chat` **não muda o contrato** — só refinamos o system prompt para reconhecer o cenário "POP global aplicado a esta unidade específica" e tolerar setores ausentes na marca.

## Mudanças por arquivo

### 1. `src/lib/holding/sectors.ts`
- Adicionar helper `getOperationalUnits()` que consulta `config_lojas` filtrando por `deriveBrand(nome) !== null` (já existe lógica). Reaproveitado pelo novo hook.

### 2. `src/hooks/usePOPWizardBatch.ts` (novo)
- Recebe `attachment: ExtractedAttachment` + `targetUnits: Array<{ unitId, unitName, brand, monthYear }>`.
- Para cada unidade, em paralelo (Promise pool de 3):
  - Monta payload igual ao Wizard atual (com `availableSectors = sectorsForBrand(brand)`, `effectiveHeadcount`, `currentConfig`).
  - Mensagem do usuário: anexo + instrução fixa "Gere a Tabela Mínima completa para esta unidade com base no POP anexado".
  - Modo `validate` (já existente) — pula entrevista e chama tool direto.
  - Faz parse de SSE até capturar `propose_staffing_changes`.
- Estado por unidade: `'queued' | 'streaming' | 'ready' | 'failed' | 'applied' | 'discarded'`, com `proposed?: ProposedPayload`, `error?: string`, e `assistantText` para o cabeçalho.
- Função `applyOne(unitId)`: chama `useUpsertHoldingStaffing` para cada change. Marca unidade como `applied`.
- Função `applyAllReady()`: aplica todas as `ready`.

### 3. `src/components/escalas/holding/POPWizardDrawer.tsx`
- Adicionar duas abas no topo: **"Esta unidade"** (fluxo atual intacto) e **"Multi-unidade (todas)"** (novo).
- Aba multi-unidade contém:
  - Bloco de anexo (reaproveita `extractAttachment`, mesmo dropzone do single).
  - Lista checkable de unidades operacionais, agrupadas por marca, com "Selecionar todas / nenhuma".
  - Botão primário **"Aplicar a todas (N unidades)"**.
  - `<UnitProposalList />` (componente novo abaixo).

### 4. `src/components/escalas/holding/UnitProposalCard.tsx` (novo)
- Card por unidade mostrando: nome + marca, status (badge), resumo da IA (markdown), tabela compacta de diff usando o `POPWizardPreview` existente (refatorar para aceitar `currentConfig` e `proposedChanges` como props).
- Ações: **Aplicar** / **Descartar** / **Re-gerar** (opcional).
- Indicador de progresso (skeleton) enquanto `streaming`.

### 5. `src/components/escalas/holding/POPWizardPreview.tsx`
- Refatorar para aceitar `currentConfig` opcional (hoje pega via hook ligado à unidade ativa). Quando passado por prop, ignora o hook. Permite reutilizar para qualquer unidade.

### 6. `supabase/functions/pop-wizard-chat/index.ts`
- Pequeno ajuste no system prompt: adicionar bloco "Quando o anexo for um POP corporativo aplicado a esta unidade específica, considere apenas os setores listados em `availableSectors`. Setores citados no POP que não existem nesta marca devem ser silenciosamente omitidos e listados em `summary` como 'não aplicáveis a esta marca'."
- Sem mudança de contrato/payload.

## Limites e segurança

- **Concurrency 3** para não saturar Lovable AI Gateway nem disparar 429.
- **Trata 429/402** por unidade individualmente — se uma falhar com 429, fica como `failed` e oferece botão "Tentar novamente"; outras seguem.
- **Apenas admins** veem a aba multi-unidade (checagem via `useUserProfile().isAdmin`, padrão já usado em `MinimumStaffingTab`).
- **Sem auto-aplicar**: nada vai pro banco sem o COO clicar Aplicar (alinhado ao memo `data-import-confirmation-standard`).
- Mês de referência: usa o `monthYear` atualmente selecionado no painel. Mostra um aviso "Aplicando ao mês X/AAAA em todas as unidades".

## Custos / IA

- Modelo: mantém `google/gemini-2.5-pro` (multimodal, já configurado). 1 chamada por unidade. ~12 unidades operacionais × ~1 chamada = aceitável.
- Anexo (texto extraído ou imagem em base64) é reenviado a cada chamada — necessário porque o gateway não reaproveita contexto entre requests.

## Fora de escopo desta entrega

- Histórico/auditoria das aplicações multi-unidade (pode virar follow-up se necessário).
- Edição inline do diff antes de aplicar (hoje o COO descarta e ajusta na grade, mantemos isso).
- OCR offline com Tesseract — ficou de fora conforme decisão; usamos o multimodal nativo do Gemini.

## Aceite

- COO anexa um POP único, escolhe unidades, aplica a todas.
- Cada unidade gera seu próprio diff respeitando seus setores disponíveis.
- COO pode aprovar/descartar individualmente ou em lote.
- Erros em uma unidade não bloqueiam as outras.
- A grade de cada unidade é atualizada via `useUpsertHoldingStaffing` existente (preserva trigger `mirror_holding_to_staffing_matrix`).
