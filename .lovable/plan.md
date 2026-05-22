# Plano — Refactor BulkImport (Fase 6 v2)

## Escopo
Substituir totalmente o `src/components/escalas/BulkImportTab.tsx` (877 linhas) por um fluxo template-driven baseado nas RPCs já existentes no backend (`get_bulk_import_template_data`, `import_schedule_slots`) e na tabela `bulk_import_logs`. Nenhuma escrita em `employees`, `job_titles` ou `cargo_aliases` no client.

## Premissas validadas
- RPCs e tabela já existem nos types gerados (`src/integrations/supabase/types.ts`).
- Único consumidor do componente: `TeamManagement.tsx` (passa `unitId`, `onDone`, `showUnitSelector={false}`). Contrato de props preservado.
- Hooks de unidade existentes serão reusados: `useAccessibleStores` (filtra por user_stores) e `useUnidade` (contexto). `xlsx` já está no projeto.

## Estrutura de arquivos

### Novos
- `src/components/escalas/bulkImport/BulkImportTab.tsx` — orquestrador (substitui o legado, mesmo caminho de import via re-export).
- `src/components/escalas/bulkImport/UnitWeekControls.tsx` — dropdown unidade + date picker semana (com normalização para segunda-feira e label "DD/MM até DD/MM").
- `src/components/escalas/bulkImport/DownloadTemplateButton.tsx` — fluxo Tarefa 2 (gera XLSX 3 abas).
- `src/components/escalas/bulkImport/UploadAndConfirm.tsx` — file picker + preview 5 linhas + confirmar (Tarefa 3).
- `src/components/escalas/bulkImport/ImportResultCard.tsx` — resumo sucesso/erro + tabela de erros + link draft.
- `src/components/escalas/bulkImport/ImportHistoryModal.tsx` — modal Tarefa 4.
- `src/components/escalas/bulkImport/lib/weekUtils.ts` — `normalizeToMonday(date)`, `formatWeekRange(monday)`.
- `src/components/escalas/bulkImport/lib/timeUtils.ts` — `normalizarHora(valor)`.
- `src/components/escalas/bulkImport/lib/xlsxTemplate.ts` — builders `buildTemplateWorkbook(data, weekStart)` e `parseFilledWorkbook(file, weekStart)` retornando `{ slots, previewRows }`.

### Modificado
- `src/components/escalas/BulkImportTab.tsx` → vira re-export (`export { BulkImportTab } from "./bulkImport/BulkImportTab"`) para não tocar em `TeamManagement.tsx`.

### Removido (após nova versão funcional)
- Todo conteúdo legado do arquivo antigo: matching por CPF, criação/upsert em `employees`, criação client-side de `schedule_drafts`, geração de template em branco, qualquer chamada de mutação a `job_titles`/`cargo_aliases`. Como o arquivo vira re-export, a remoção é a própria substituição.

### Não tocar
- `FreelancerAddModal`, triggers do banco, fluxo de IA (`ai_draft_slots`), `useEmployees`, `useJobTitles`.

## Comportamento da UI

**Props mantidas:** `{ unitId?: string | null; onDone?: () => void; showUnitSelector?: boolean }`.

**Seleção de unidade:**
- Se `showUnitSelector === false` e `unitId` veio por prop → usa direto (caso `TeamManagement`).
- Senão: lista de `useAccessibleStores()`. Se 1 unidade, pré-seleciona e desabilita dropdown.

**Semana de referência:** Popover + `Calendar` (shadcn) `mode="single"`, com `pointer-events-auto`. Estado interno guarda segunda-feira normalizada. Label "DD/MM até DD/MM" (segunda a domingo).

**Botão "Baixar Modelo"**: disabled enquanto unitId ou weekStart vazios. Chama `get_bulk_import_template_data` e gera workbook com 3 abas conforme spec (coluna ID oculta com `hidden:true, wch:0`).

**Upload**: input `accept=".xlsx"`. Após selecionar arquivo, parse imediato → mostra preview (tabela com 5 primeiras linhas com horários detectados) + botão "Confirmar Importação". Botão "Cancelar" limpa estado.

**Confirmar**: monta `slots[]` (um por dia preenchido — só se início E fim presentes), chama `import_schedule_slots`. Toasts conforme `result.status` (sucesso/parcial/erro).

**Resultado**: card com `total_sucesso` (verde) / `total_erro` (laranja), timestamp, nome do arquivo, link "Ver draft criado" (`/escalas/draft/{draft_id}` — confirmar rota com fallback para console se não existir). Tabela de erros se `total_erro > 0`, resolvendo `employee_id → nome` via mapa do template carregado em memória durante o import.

**Histórico**: link abaixo do resultado abre `Dialog` que consulta `bulk_import_logs` (top 20 por unidade), com expand para `erros` JSONB.

## Detalhes técnicos

**Tipagem:** usa `Database['public']['Functions']['get_bulk_import_template_data']['Returns']` e tipa `import_schedule_slots` return como `{ log_id: string; draft_id: string; total_linhas: number; total_sucesso: number; total_erro: number; erros: Array<{linha:number; employee_id?:string; data?:string; motivo:string}>; status: 'sucesso'|'parcial'|'erro' }`.

**Normalização de semana:** `normalizeToMonday`: `const d = new Date(date); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate()+diff); return d;` — operando em data local, gravando YYYY-MM-DD via helper para evitar bug de timezone (regra do projeto).

**Payload do slot:** `schedule_date` calculado somando dias à segunda **em data local** (não usar `toISOString()` direto sobre `Date` mutado — usa formato `yyyy-MM-dd` via `date-fns/format` já presente, conforme padrão do projeto).

**`normalizarHora`:** conforme spec, com suporte a número Excel (fração do dia) e string `HH:MM`/`H:MM`/`HH:MM:SS`. Lança erro capturado pelo parser, que acumula em `previewErrors` exibido antes do submit.

**Permissão**: erro da RPC `get_bulk_import_template_data` (RLS) → toast "Sem acesso a essa unidade ou erro no servidor". Sem fallback.

## Acessibilidade
Labels em todos inputs/selects, `aria-label` nos botões de ação, focus inicial no primeiro controle do modal de histórico, `DialogTitle` obrigatório.

## Testes de aceitação (Tarefa 6)
Documentar no chat após implementação. Não automatizar — execução manual pelo usuário (gerente MULT 14 / CAJU 01 conforme spec). Reporto status esperado de cada cenário.

## Fora de escopo
- Não alterar `TeamManagement.tsx`.
- Não criar migrações (backend pronto).
- Não tocar em fluxo IA nem em `FreelancerAddModal`.
