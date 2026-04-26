# 🤖 Motor de IA para Importação de Dados — Central Holding

## Objetivo
Criar um motor inteligente de ingestão que aceita **XLSX, CSV, PDF e imagens**, usa **Lovable AI (Gemini 2.5 Flash)** para mapear colunas e extrair dados, distribui para 3 tabelas-destino com **preview rápido**, executa **sincronização automática diária** via cron, e exibe uma nova sub-aba **"Diário"** com visualizações por dia.

---

## 1. Mudanças no Banco de Dados (migration)

### Nova tabela `import_jobs`
Rastreia cada importação (manual ou automática) com preview, status e auditoria:

```sql
CREATE TYPE import_origem AS ENUM ('upload_manual', 'cron_sheets', 'api');
CREATE TYPE import_destino AS ENUM ('store_performance', 'store_performance_entries', 'reclamacoes', 'misto');
CREATE TYPE import_status AS ENUM ('extracting', 'preview_ready', 'confirmed', 'error', 'cancelled');

CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem import_origem NOT NULL,
  tipo_destino import_destino,
  file_name text,
  file_mime text,
  source_url text,             -- url do Google Sheet (cron)
  ai_model text,               -- ex: google/gemini-2.5-flash
  ai_confianca numeric,        -- 0..1
  preview_data jsonb,          -- linhas extraídas (até 200)
  total_linhas int DEFAULT 0,
  linhas_validas int DEFAULT 0,
  lojas_nao_mapeadas jsonb DEFAULT '[]'::jsonb,
  mapeamento_colunas jsonb,    -- {coluna_origem: campo_destino}
  status import_status DEFAULT 'extracting',
  erro text,
  linhas_importadas int DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: admin/operator veem tudo; demais usuários só os próprios jobs
CREATE POLICY "import_jobs_admin_all" ON public.import_jobs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'));

CREATE POLICY "import_jobs_own" ON public.import_jobs
  FOR SELECT TO authenticated USING (created_by = auth.uid());
```

### Adições em `sheets_sources`
Marca quais fontes entram no cron diário e qual o tipo de dado esperado:

```sql
ALTER TABLE public.sheets_sources
  ADD COLUMN IF NOT EXISTS sync_diario boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_dado import_destino DEFAULT 'store_performance_entries',
  ADD COLUMN IF NOT EXISTS ultima_execucao_cron timestamptz;
```

### Habilitar extensions para cron
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Cron job diário (executado às 06:00 BRT = 09:00 UTC)
Será criado **via tool insert** (não migration), pois contém URL/anon key.

---

## 2. Edge Functions (4 novas)

Todas com `verify_jwt = false` em `supabase/config.toml`, validação Zod, CORS, e uso do `LOVABLE_API_KEY`.

### 2.1 `ai-import-extract`
**Input**: `{ fileBase64, fileName, mimeType, hintDestino? }`
**Fluxo**:
1. Detecta tipo do arquivo (xlsx/csv → texto via SheetJS; pdf/imagem → base64 multimodal).
2. Chama Lovable AI Gateway (`google/gemini-2.5-flash`) com **tool calling** (`extract_dataset`) para retornar JSON estruturado:
   - `tipo_destino` detectado (mensal/diario/reclamacoes)
   - `mapeamento_colunas` (qual coluna corresponde a faturamento, nps, data, unidade…)
   - `linhas` normalizadas (até 200 para preview)
   - `confianca` (0..1)
3. Faz fuzzy match de unidades contra `config_lojas` (usa `src/lib/fuzzyMatch.ts` lógica replicada).
4. Cria registro em `import_jobs` com `status='preview_ready'` e retorna `{ jobId, preview, lojasNaoMapeadas, totalLinhas }`.
5. Trata erros 429 (rate limit) e 402 (créditos).

### 2.2 `ai-import-confirm`
**Input**: `{ jobId, lojaOverrides?: { [originalName]: lojaId } }`
**Fluxo**:
1. Busca job em `import_jobs`.
2. Aplica overrides do usuário para lojas não mapeadas.
3. Distribui linhas conforme `tipo_destino`:
   - `store_performance` → UPSERT por `(loja_id, month_year)`
   - `store_performance_entries` → UPSERT por `(loja_id, entry_date)`
   - `reclamacoes` → INSERT (com `referencia_mes` calculado)
   - `misto` → distribui automaticamente por linha
4. Atualiza `import_jobs.status='confirmed'`, `linhas_importadas`, `confirmed_at`.

### 2.3 `cron-import-sheets`
**Input**: nenhum (chamado pelo pg_cron)
**Fluxo**:
1. Lista `sheets_sources WHERE ativo=true AND sync_diario=true`.
2. Para cada fonte: baixa CSV (via `export?format=csv&gid=`), envia ao mesmo pipeline do `ai-import-extract`.
3. **Auto-confirma** se `confianca >= 0.85` E `lojas_nao_mapeadas.length = 0`.
4. Caso contrário, deixa em `preview_ready` para revisão manual no painel.
5. Atualiza `sheets_sources.ultima_execucao_cron`.

### 2.4 `ai-import-cancel`
**Input**: `{ jobId }`
Marca job como `cancelled` (sem deletar — auditoria).

---

## 3. Hook novo: `src/hooks/useImportJobs.ts`

Funções:
- `useImportJobs()` — lista jobs (paginação `.range(0,49)`)
- `useExtractFile(file, hint)` — chama `ai-import-extract`
- `useConfirmImport(jobId, overrides)` — chama `ai-import-confirm`
- `useCancelImport(jobId)` — chama `ai-import-cancel`
- Invalidação automática de queries `['import_jobs']`, `['store_performance']`, `['reclamacoes']`, `['painel-*']` após confirmação.

---

## 4. Componentes novos

### 4.1 `src/components/dashboard/AiImportSection.tsx`
Nova seção dentro da aba **"Upload de Dados"** do `HoldingCentralTab`:
- Drop zone (XLSX/CSV/PDF/PNG/JPG, até 20MB) — usa `<input type="file" capture="user">` para mobile.
- Botão "Analisar com IA" → chama `extract`.
- Loading state com skeleton (extração leva 3-8s).
- Ao receber preview → abre `ImportPreviewModal`.
- Lista de jobs recentes (últimos 20) com status Badge:
  - `extracting` = azul (animado)
  - `preview_ready` = âmbar (clicável → reabre modal)
  - `confirmed` = verde
  - `error` = vermelho
  - `cancelled` = cinza

### 4.2 `src/components/dashboard/ImportPreviewModal.tsx`
shadcn `Dialog` (não `Sheet`, para suportar tabela larga):
- **Header**: ícone do tipo detectado + nome do arquivo + Badge confiança IA (verde ≥85%, âmbar 60-84%, vermelho <60%).
- **Resumo**: total de linhas, linhas válidas, totais agregados (faturamento total, nº reclamações).
- **Tabela**: 10 primeiras linhas com `Table` shadcn, colunas conforme `tipo_destino`.
- **Bloco "Lojas não mapeadas"** (se houver): cada nome desconhecido com `Select` para vincular a `config_lojas` ou marcar "ignorar".
- **Mapeamento de colunas** (collapsible): permite usuário ajustar manualmente o mapeamento sugerido pela IA.
- **Botões**: `Cancelar` | `Confirmar Importação` (disabled se houver lojas pendentes sem decisão).

### 4.3 Sub-aba "Diário" — adicionada em `PainelMetasTab.tsx`
Novo `value='diario'`, ícone `CalendarDays`, label "Diário":
- Filtro de período: últimos 7 / 14 / 30 / 90 dias (Tabs ou Select).
- 4 KPI cards: Faturamento Total, Ticket Médio Diário, Total Reclamações, Faturamento/Reclamação médio.
- **LineChart** (recharts) — Faturamento Salão vs Delivery por dia.
- **BarChart** (recharts) — Reclamações Salão vs iFood por dia.
- **Tabela** — agrupada por loja, mostra dias com lançamento (ordem decrescente).
- Query: `store_performance_entries` filtrada por `entry_date` no range, JOIN `config_lojas(nome)`.
- Skeleton loading independente em cada bloco.

---

## 5. Atualização do `HoldingCentralTab.tsx`
Aba "Upload de Dados" passa a ter 4 seções (em vez de 3):
1. **Importação com IA** (`AiImportSection`) ← **NOVO, no topo**
2. Fontes do Google Sheets (existente, com novo toggle "Sync diário automático" e Select "Tipo de dado")
3. Histórico de sincronizações (existente)
4. Lançamento manual (existente)

---

## 6. Atualização do `PainelMetasTab.tsx`
- Adiciona sub-aba `'diario'` (visível para todos os perfis com acesso ao painel).
- Nenhuma quebra de compatibilidade com sub-abas atuais (visao/nps/conformidade/planos/holding).

---

## 7. Modelo de IA escolhido — `google/gemini-2.5-flash`
**Justificativa**:
- **Multimodal nativo** (lê PDF e imagem direto, sem OCR separado).
- **Tool calling robusto** para extração estruturada.
- **~3x mais barato e ~5x mais rápido** que GPT-5 e Gemini Pro.
- Adequado ao caso de uso "mapear colunas + extrair tabelas", onde alta precisão semântica não é crítica (usuário sempre revisa preview).

Alternativas (configuráveis via env futuro): `gemini-2.5-pro` (PDFs complexos), `gpt-5-mini` (texto puro mais nuançado).

---

## 8. Segurança e Padrões do Projeto
- ✅ RLS em `import_jobs` (admin/operator full, demais só próprios jobs)
- ✅ `verify_jwt=false` nas edge functions + validação Zod do body
- ✅ Sem segredos no client — `LOVABLE_API_KEY` só no edge
- ✅ Preview obrigatório antes de gravar (padrão `data-import-confirmation-standard`)
- ✅ Datas mantidas como `YYYY-MM-DD` puro (memória `date-handling-standard`)
- ✅ Paginação `.range(0,49)` no listing de jobs
- ✅ `useQueryClient().invalidateQueries` após cada mutation
- ✅ Sem emojis na UI — apenas `lucide-react` (`Sparkles`, `FileSpreadsheet`, `Upload`, `Bot`, `CalendarDays`, `CheckCircle2`, `AlertTriangle`)
- ✅ Estética Liquid Glass (cards `glass-card`, blur, coral CajuPAR)

---

## 9. Arquivos Afetados

**Migration (schema)**:
- nova migration: `import_jobs` + enums + colunas em `sheets_sources` + extensions

**Insert SQL (cron — via tool insert, não migration)**:
- `cron.schedule('cron-import-sheets-daily', '0 9 * * *', …)`

**Edge Functions (criadas)**:
- `supabase/functions/ai-import-extract/index.ts`
- `supabase/functions/ai-import-confirm/index.ts`
- `supabase/functions/ai-import-cancel/index.ts`
- `supabase/functions/cron-import-sheets/index.ts`

**Config**:
- `supabase/config.toml` → adicionar `verify_jwt = false` para as 4 funções

**Hook (criado)**:
- `src/hooks/useImportJobs.ts`

**Componentes (criados)**:
- `src/components/dashboard/AiImportSection.tsx`
- `src/components/dashboard/ImportPreviewModal.tsx`

**Componentes (alterados)**:
- `src/components/dashboard/HoldingCentralTab.tsx` (nova seção + toggles em sheets_sources)
- `src/components/dashboard/PainelMetasTab.tsx` (nova sub-aba "Diário" com `DiarioView`)

---

## 10. Entregáveis ao final
1. Upload de planilha XLSX → preview em <8s → 1 clique para gravar.
2. Upload de PDF/imagem de relatório → IA extrai dados → preview → grava.
3. Cron diário às 06:00 BRT puxa todos os Google Sheets marcados como `sync_diario` automaticamente.
4. Sub-aba "Diário" no Painel de Metas com gráficos por dia dos últimos 7-90 dias.
5. Histórico completo de imports (com IA confidence score) auditável em `import_jobs`.
