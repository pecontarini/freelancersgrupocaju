# Diagnóstico

Olhando o request real (network logs), o fluxo atual está mandando o **Excel inteiro** (`ESCALA MÍNIMA ABRIL.xlsx`, com 16 abas: `CAJULIMÃO - SUDOESTE`, `CAJULIMÃO - ASA NORTE`, `CP ASA NORTE`, `CP - NAZO SIG`, ...) em **cada uma das 16 chamadas** ao Gemini. Em cada chamada eu peço para a IA "encontrar a parte da unidade X". Resultado:

- A IA confunde abas parecidas (Caju Sudoeste vs Caju Norte) e devolve dados misturados.
- Cada chamada é lenta (Gemini relê tudo) e pode estourar timeout/contexto.
- O auto-apply até dispara, mas as propostas chegam erradas/atrasadas, parecendo "não funcional".

Como o Excel **já vem segmentado por aba (uma aba = uma unidade)**, o caminho certo é fazer o matching aba↔unidade no client, **antes** de chamar a IA, e enviar só o pedaço relevante.

# Plano

## 1. Expor abas separadas no extrator (`src/lib/extract-attachment-text.ts`)

- Adicionar campo `sheets?: ExtractedSheet[]` em `ExtractedAttachment`, com `{ name, text }` por aba.
- Em `extractExcelText`, além do texto concatenado, devolver também o array de abas individuais (sem truncar — cada aba isolada é pequena).

## 2. Matcher aba↔unidade (`src/lib/holding/sheet-matcher.ts`, novo)

- Função `matchSheetToUnit(sheets, unitName, brand)` que normaliza nomes (uppercase, sem acento, sem pontuação) e procura a aba que melhor casa com o nome da unidade.
- Tokens de marca (`CAJU`, `CAMINITO`/`CP`, `NAZO`, `FOSTER`) + tokens de bairro extraídos do `unitName` (`SUDOESTE`, `ASA NORTE`, `ASA SUL`, `SIG`, etc.).
- Score por interseção de tokens; threshold mínimo para evitar falso match.
- Retorna `{ sheet, score }` ou `null`.

## 3. Roteamento no batch (`src/hooks/usePOPWizardBatch.ts`)

- Em `runForUnit`, se o anexo tem `sheets` e há match para a unidade, montar um `ExtractedAttachment` "virtual" só com o texto daquela aba (`text = "--- Aba: X ---\n<csv>"`).
- Se não houver match, fallback para o anexo inteiro como hoje (com aviso no `assistantText`).
- Adicionar pré-passo síncrono no `run()` que loga quais unidades casaram com qual aba e quais ficaram sem match — exibir isso na UI antes de disparar a IA, para o COO confirmar.

## 4. Auto-apply: garantir que o estado da grade atualiza

- Após cada `applyJob` bem-sucedido, invalidar a query `["holding_staffing_config", unitId, monthYear]` (e a chave global `["holding_staffing_config"]`) usando `useQueryClient` no hook. Hoje a invalidação só acontece quando o usuário fecha o drawer.

## 5. UI: mostrar mapeamento aba→unidade antes do run (`POPWizardMultiPanel.tsx`)

- Após anexar Excel, exibir uma seção "**3. Mapeamento detectado**" com lista:
  - `CAJU LIMÃO SUDOESTE` → aba `CAJULIMÃO - SUDOESTE` (pronta)
  - `FOSTER'S TAGUATINGA` → **sem aba correspondente** (será ignorada)
- Botão Run desabilita se 0 unidades casarem; aviso se algumas casarem.

## 6. Ajuste no edge function (`supabase/functions/pop-wizard-chat/index.ts`)

- Sem mudança de schema, só refinar o system prompt para o caso "anexo já filtrado por unidade" (sinalizar via `context.sheetMatched: true`) — instruindo a IA a confiar 100% no texto recebido sem procurar outras unidades.

# Resultado esperado

- 16 unidades processam **muito mais rápido** (cada chamada vê só sua aba ~2KB em vez do Excel inteiro 50KB).
- Zero confusão entre unidades parecidas.
- Ao terminar de ler cada unidade, a proposta é aplicada automaticamente e a grade já reflete os números no banco.
- COO vê antes do run quais unidades vão ser processadas e quais foram puladas por falta de aba.

# Fora de escopo

- Mudanças no formato do POP corporativo PDF/imagem (esses continuam usando o fluxo atual de mandar o anexo inteiro — só Excel ganha o roteamento).
- Reorganização visual do drawer.
