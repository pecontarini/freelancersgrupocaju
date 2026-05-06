## Objetivo

Transformar o MVP do Gerador de Escalas IA (hoje renderizado abaixo das abas via `EscalasItaimSection`) em uma **sub-aba dedicada dentro de Escalas**, visível **somente quando a unidade ativa é Caju Limão Itaim** (`87228077-03ab-445b-a409-237972ee6719`). O system prompt continua fixo na edge function `gerar-escala-ia` (sem alteração). Visual e padrões idênticos às demais unidades (mesmo `glass-card`, mesmas `Tabs`, mesmas badges coral).

## Escopo

### 1. Nova aba "Gerador IA (MVP)" em `EscalasTab.tsx`
- Adicionar `TabsTrigger` com ícone `Sparkles` + label "Gerador IA (MVP)" / mobile "IA MVP".
- A aba só é renderizada quando `effectiveUnidadeId === UNIDADE_ID_ITAIM` (importar `useUnidade`).
- O conteúdo da aba é o `<EscalasItaimSection />` já existente (componente reaproveitado integralmente, sem refactor de lógica).
- Posicionar a aba logo após "Editor de Escalas" para destaque.
- Remover o `TabsTrigger value="gerador-ia"` atual (genérico) **apenas se** ele for redundante para Itaim — manter para outras unidades. Decisão: **manter** o "Gerador IA" genérico intacto; a nova aba MVP é independente e adicional.

### 2. Remover render duplicado em `GestaoPessoasTab.tsx`
- Remover `<EscalasItaimSection />` que hoje aparece abaixo de `<Tabs>` (linha 33). O conteúdo passa a viver exclusivamente dentro da nova sub-aba.
- Remover import órfão.

### 3. Ajuste cosmético em `EscalasItaimSection.tsx`
- Como agora vive dentro de uma aba (não mais como seção solta), remover o `<Separator />` e o badge "MVP · Caju Limão Itaim" + título redundante do header da seção (linhas ~515–523), mantendo apenas o conteúdo (seletor de setor, navegador de semana, card de status). O badge MVP migra para um `CardHeader` mais discreto no topo do conteúdo, alinhado ao padrão visual das outras abas.
- Nenhuma mudança em lógica, queries, fluxo de aprovação, vinculação ou exportação.

### 4. Sem alterações em
- Edge function `gerar-escala-ia` e `prompt.ts` (system prompt permanece fixo).
- Tabelas `escala_template`, `escala_minima`, `turno_config`, `escala_vinculacao`.
- `EscalaApprovalPanel`, `EscalaVinculacaoBuilder`.
- Demais abas de Escalas (Editor, D-1, Quadro, etc.) e fluxo de outras unidades.

## Detalhes técnicos

**Gating da aba (em `EscalasTab.tsx`):**
```ts
const UNIDADE_ID_ITAIM = "87228077-03ab-445b-a409-237972ee6719";
const { effectiveUnidadeId } = useUnidade();
const isItaim = effectiveUnidadeId === UNIDADE_ID_ITAIM;
```
Renderizar `<TabsTrigger value="ia-mvp">` e `<TabsContent value="ia-mvp"><EscalasItaimSection/></TabsContent>` apenas se `isItaim`.

**Comportamento ao trocar de unidade:** se o usuário estiver na aba "ia-mvp" e mudar para outra loja, fazer `useEffect` para resetar `tab` para `"scheduler"` evitando aba vazia.

## Resultado esperado

- Itaim selecionada → aba "Gerador IA (MVP)" aparece dentro de Escalas com mesmo visual das demais abas; todo o fluxo (gerar → aprovar → vincular → exportar) funciona como hoje.
- Outras unidades → aba não aparece; tudo segue idêntico ao atual.
- Nenhum render duplicado abaixo das abas em Gestão de Pessoas.