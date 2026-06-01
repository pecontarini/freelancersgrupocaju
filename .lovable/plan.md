# B5 — Importação Excel de Escalas: matching robusto + revisão manual

Objetivo: parar de criar cadastros fantasma no upload Excel. Match primário por CPF (quando a planilha tiver), fallback por nome com cascata (exato → fuzzy alto). Não-casados vão para modal de revisão; nada é criado sem decisão explícita do gestor.

---

## a) Arquivos tocados (Modify) + naturezas

1. `**src/lib/scheduleExcel.ts**` — Modify (parser)
  - **L60–66 (constants)**: adicionar `CPF_HEADER_ALIASES`, `NAME_HEADER_ALIASES`, helper `normalizeCpf(v)` (strip não-dígitos, valida `length===11`).
  - **L420–450 (header scan em `parseSingleSectorSheet`)**: ao localizar a linha de sub-header (`ENTRADA`), também varrer a linha de cabeçalho principal (`NOME / CARGO / ...`) procurando coluna CPF via aliases. Resultado: `cpfCol: number | null`. Heurística:
    - normalizar header (NFD + UPPER + trim), aceitar `CPF`, `C.P.F`, `C P F`, `CPF/MF`, `DOCUMENTO`, `DOC`, `RG/CPF` contendo "CPF".
    - se múltiplas colunas casarem, log `console.warn` e usar a primeira.
  - **L499–524 (build do `nameMap`)**: além do `nameMap`, construir `cpfMap: Map<cpf11, {id,name}>` a partir de `allEmployees` (precisa do CPF; ver item 2). Manter dedup já existente para homônimos.
  - **L545–575 (cascata de match por linha)**: nova ordem:
  1. Se `cpfCol != null` e linha tem CPF normalizável → lookup em `cpfMap`. **Match → resolvido**. Sem fuzzy.
  2. Senão (sem CPF na linha ou sem coluna CPF): nome normalizado exato no `nameMap`.
  3. Senão: fuzzy via `stringSimilarity` existente (Levenshtein normalizado, já em `src/lib/fuzzyMatch.ts`), threshold **≥ 0.90**.
    - Coletar TODOS os candidatos ≥ 0.90. Se exatamente 1 → usar. Se 2+ → **NÃO escolher**: empurrar para `unmatchedEmployees` com `ambiguous: true` e lista de candidatos (até 5, ordenados por similaridade) para o modal resolver.
  4. Senão: `unmatchedEmployees` normal (sem candidatos).
    Atualizar `UnmatchedEmployee`** (L45–49) para:
    `ts
    terface UnmatchedEmployee {
    rowIndex: number;
    name: string;
    cargo: string;
    cpf?: string | null;           // CPF normalizado se a planilha tinha
    reason: "no_match" | "ambiguous";
    candidates?: Array<{ id: string; name: string; similarity: number; cpf?: string | null }>;
    `umular contadores no`ScheduleParseResult`:` matchedByCpf`,` matchedByExactName`,` matchedByFuzzy`(somar e devolver — modelar como`matchStats`).
2. `**src/components/escalas/ScheduleExcelFlow.tsx**` — Modify (orchestrator + modal)
  - **L70–76 props**: aceitar opcionalmente `allUnitEmployees` já enriquecido com `cpf` (ver item 3). Sem mudança de assinatura quebrando.
  - **L131–154 `runParse**`: passar `allEmps` com CPF (já vem se o hook injetar).
  - **L189–293 `registerUnmatchedEmployees**`: **REMOVER** o caminho de criação silenciosa por `ilike(name)` + insert. Substituir por execução APENAS das decisões coletadas do novo modal de revisão (ver item 4): `link_existing` → reusa id; `create_new` → insert com CPF (se houver na linha) + cargo; `ignore` → pula.
    - A criação só roda se `decision === "create_new"` E o gestor confirmou explicitamente o nome/cargo/CPF no formulário do modal.
  - **Estado novo**: `reviewModalOpen`, `reviewDecisions: Map<rowIndex, ReviewDecision>`.
  - **Fluxo**: após parse, se `unmatchedEmployees.length > 0` → abrir `<UnmatchedReviewDialog/>` ANTES do botão "Salvar". Salvar fica desabilitado até todas as linhas terem decisão.
  - **Toast final** (relatório): substituir toast genérico por um com breakdown (item f).
3. **Hook fornecedor de `allUnitEmployees**` — Modify mínimo
  - Onde `ScheduleExcelFlow` recebe `allUnitEmployees` (consumidores do componente, p.ex. `ManualScheduleGrid` ou container do editor): garantir que o select inclui `cpf`. Vou rodar grep antes de mexer; se já vem, zero mudança. Se não, adiciono apenas o campo `cpf` no select — sem mexer em hooks de listagem (`useEmployees`, `useSchedulableEmployees`) por escopo.
  - **Grep planejado**: `rg "allUnitEmployees" src/components/escalas` para localizar 1–2 callers.
4. `**src/components/escalas/UnmatchedReviewDialog.tsx**` — **Add** (componente novo)
  - Reusa `Dialog`, `Table`, `Button`, `Input`, `Command` (combobox de busca) do shadcn já no projeto.
  - Estrutura: ver item (d).
5. `**src/components/escalas/ImportSummaryPanel.tsx**` — **Add** (componente leve)
  - Painel persistente embaixo do modal de import com cards de contagem: processadas / CPF / exato / fuzzy / manual / ignoradas. Não bloqueante; aparece após `Salvar`.

---

## b) Biblioteca fuzzy

**Decisão proposta: NÃO adicionar dependência nova.**

- Já existe `stringSimilarity` em `src/lib/fuzzyMatch.ts` (Levenshtein normalizado). Foi a função usada no B3. Mantém consistência entre módulos.
- Vou subir o threshold para **0.90** (hoje está 0.85) e adicionar a regra **"2+ candidatos ≥ threshold ⇒ ambíguo, vai pro modal"**. Isso resolve o caso "Matheus Xavier" vs "Matheus Vieira Xavier" com mais segurança que Jaro-Winkler isolado — Levenshtein normalizado dá ~0.79 nesse par, então cai em ambíguo/no_match e o gestor decide (que é o objetivo final).
- Se quiser Jaro-Winkler especificamente: posso implementar inline (~30 linhas, zero dep). Marcar como decisão bloqueante (h).

**Não instalo `fast-fuzzy`/`string-similarity` sem aprovação.**

---

## c) Detecção da coluna CPF (heurística)

```
CPF_HEADER_ALIASES = ["CPF","C.P.F","C P F","CPF/MF","DOCUMENTO","DOC"]
```

- Normalizo cada célula da linha de cabeçalho principal (a linha logo acima de `ENTRADA`, hoje detectada como `dayHeaderRow`/`titleRow`) com NFD+UPPER+trim+collapse-spaces.
- Match: header normalizado === alias OU contém token "CPF".
- Se nenhuma coluna casar → `cpfCol = null` → cai no fluxo só-nome.
- Validação por amostragem: na primeira linha de dados, se a coluna candidata tem valor que normaliza pra 11 dígitos, confirma; se 0/N amostras → descarta e `console.warn`.

Aceita formatos: `"123.456.789-01"`, `"12345678901"`, `"123 456 789 01"`, `"123.456.789-01 "`. Tudo via `replace(/\D/g,"")` + check length 11.

---

## d) Modal "Não-casados" (componente novo)

`UnmatchedReviewDialog` (shadcn `Dialog` + `Table`):

```text
┌────────────────────────────────────────────────────────────┐
│ Revisar funcionários não identificados (N linhas)          │
├────────────────────────────────────────────────────────────┤
│ Linha │ Nome planilha   │ Cargo │ CPF  │ Decisão           │
│  12   │ Matheus Xavier  │ Garçom│ ...  │ [Vincular ▼]      │
│       │   → sugestões:  Matheus Vieira Xavier (0.79)       │
│       │                 Matheus Silva       (0.61)         │
│  18   │ João Pedro      │ Cozinha│ —   │ [Criar novo ▼]    │
│       │   → nome: [_______]  cargo: [____]  CPF: [______]  │
│  22   │ Linha estranha  │ —     │ —   │ [Ignorar ▼]        │
├────────────────────────────────────────────────────────────┤
│        [Cancelar import]              [Confirmar (N/N)]    │
└────────────────────────────────────────────────────────────┘
```

- **Coluna "Decisão"**: `DropdownMenu` com 3 opções:
  - `Vincular a existente` → abre `Command` (busca em `allUnitEmployees` por nome/CPF). Pré-preenche com `candidates[0]` se existir.
  - `Criar novo cadastro` → expande inputs (nome editável, cargo, CPF opcional). Validação CPF (11 dígitos se preenchido).
  - `Ignorar esta linha` → marca como skipped.
- Botão `Confirmar` desabilitado até todas as linhas terem decisão válida.
- Linhas com `reason: "ambiguous"` aparecem destacadas com `AlertTriangle` (lucide).

Não cria componente de busca novo: reusa `Command`/`Popover` do shadcn já em uso no projeto (vide `CnpjQuickRegisterDialog`, `UnitPartnerLinkModal`).

---

## e) Detecção coluna CPF (resumo)

Ver (c). Heurística dupla: aliases de header + amostragem de 1ª linha de dados.

---

## f) Resumo final do import

**Duas camadas:**

1. **Toast `sonner**` imediato após salvar:
  `"38 escalas salvas · 24 CPF · 8 nome exato · 4 fuzzy · 2 manual · 0 ignoradas"`
2. **Painel persistente** (`ImportSummaryPanel`) renderizado dentro do `Dialog` após `isSaving=false` e enquanto o gestor não fechar o modal. Cards com `lucide-react` (CheckCircle2, UserPlus, UserX, AlertTriangle). Permite revisar antes de fechar.

Não persiste em DB (escopo proíbe schema). É estado local da sessão de import.

---

## g) Riscos de regressão


| Risco                                                                                    | Mitigação                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fluxo atual de import quebra para planilhas SEM coluna CPF                               | `cpfCol = null` → cai no caminho atual (nome exato + fuzzy). Comportamento equivalente, só com threshold mais alto.                                                                                                  |
| Threshold 0.85 → 0.90 manda mais coisa pro modal                                         | Esperado e desejado (zero fantasma). Gestor decide. Documentar no toast.                                                                                                                                             |
| Multi-setor (`parseMultiSectorFile`) — múltiplas abas                                    | Mesmo parser por aba é chamado; `unmatchedEmployees` já é agregado em L867–890. Modal recebe lista unificada com `sectorName` opcional para contexto (adicionar campo `sectorHint?: string` em `UnmatchedEmployee`). |
| `allUnitEmployees` sem CPF nos callers                                                   | Se select não trouxer CPF, `cpfMap` fica vazio e match CPF nunca acontece — degrada para comportamento atual. Não quebra.                                                                                            |
| Componentes que importam `UnmatchedEmployee` quebram com novo campo `reason` obrigatório | Campos novos com `?` (opcionais). Compatível.                                                                                                                                                                        |
| `registerUnmatchedEmployees` é chamado em algum outro lugar?                             | **Grep antes de mexer**: `rg "registerUnmatchedEmployees" src`. Esperado: só dentro do mesmo arquivo.                                                                                                                |


**Fora do escopo (não toco):** `useDailyRoster`, `useEmployees`, `useSchedulableEmployees`, `useD1Schedules`, schema, RLS, hooks de listagem.

---

## h) Decisões bloqueantes pra você

1. **Fuzzy lib**: confirmo uso do `stringSimilarity` (Levenshtein) atual com threshold 0.90 + regra de ambiguidade? Ou quer Jaro-Winkler inline (~30 linhas, sem dep)?
2. **Threshold de auto-match fuzzy**: 0.90 ok? (acima dispara auto-match se 1 candidato; abaixo ou empate vai pro modal)
3. **Cadastro novo via modal**: gênero default `M` e `worker_type: "clt"` (como hoje)? Ou exigir escolha no modal?
4. **Painel resumo persistente** ou só toast? Toast já cobre, painel adiciona ~50 linhas de UI.

---

## Plano de execução (lote único após aprovação)

1. `scheduleExcel.ts`: novos helpers + heurística header CPF + `cpfMap` + cascata + tipo `UnmatchedEmployee` estendido + `matchStats`.
2. `UnmatchedReviewDialog.tsx`: componente novo.
3. `ImportSummaryPanel.tsx`: componente novo (se decisão = sim no item h.4).
4. `ScheduleExcelFlow.tsx`: substituir `registerUnmatchedEmployees`, integrar modal de revisão, toast/painel de resumo.
5. Grep de validação: `registerUnmatchedEmployees`, `unmatchedEmployees`, `UnmatchedEmployee` — confirmar callers só dentro do escopo.
6. Conferir que `parseMultiSectorFile` agrega o novo formato.

**Não commito. Não adiciono lib. Não toco em hooks fora do escopo.**  
  
Plano aprovado com 1 ajuste em D3 e 1 adição.

DECISÕES:

D1 — Fuzzy lib: aprovado. Use stringSimilarity
(Levenshtein) com threshold 0.90 + regra de ambiguidade
(2+ candidatos ≥ threshold vão pro modal).

D2 — Threshold 0.90: aprovado.

D3 — AJUSTE: NÃO defaultar gênero=M nem worker_type=clt
no formulário de "Criar novo". EXIGIR escolha no modal:
  • Gênero: dropdown obrigatório (M/F/Outro)
  • worker_type: dropdown obrigatório (CLT/Freelancer)
Justificativa: defaults aqui criam dados sujos no banco
(relatórios de diversidade ficam errados, muitos imports
são pra freelancers e viraram clt no banco).

D4 — Só toast, sem painel persistente. Cobre o caso de
uso, evita 50 linhas de UI que o gestor olha por 2s.

ADIÇÃO — Validação de CPF duplicado no "Criar novo":

Ao gestor digitar CPF no formulário do modal, fazer
lookup em employees:
  • CPF existe e active=true: warning bloqueante
    "Já existe cadastro ativo: [Nome]" + sugerir
    botão "Vincular a esse"
  • CPF existe e active=false: info não-bloqueante
    "Existe cadastro inativo: [Nome]. Reativar?"
    com botão "Reativar" (UPDATE active=true)
  • CPF não existe: prossegue normal

Custo: 1 query reativa ao input + alert. Ganho:
fecha completamente a porta pra fantasmas. Caso Matheus
Xavier (4 cadastros mesmo CPF) não conseguiria virar
5º nem por descuido do gestor.

Pode executar B5 em lote único.

REPORTE:
  • Arquivos tocados (criados + modificados)
  • Greps de validação que você listou
  • Descrição visual dos 2 componentes novos
    (UnmatchedReviewDialog + ImportSummaryPanel se aplicável)
  • Confirmação de que registerUnmatchedEmployees não
    cria mais cadastro silencioso em lugar nenhum

Não commitar — eu commito ao final.