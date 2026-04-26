
# Integração n8n → Central de Reclamações

## Objetivo

Criar um endpoint público e seguro para o n8n enviar reclamações automaticamente (1x ou 2x por dia, conforme a automação), com normalização de dados, deduplicação, rastreamento de execuções e visualização na Central Holding.

---

## Arquitetura proposta

```
┌─────────┐    HTTPS POST    ┌──────────────────────┐    INSERT    ┌──────────────┐
│   n8n   │ ───────────────► │  Edge Function       │ ───────────► │ reclamacoes  │
│         │  (webhook + key) │  ingest-reclamacoes  │              └──────────────┘
└─────────┘                  │                      │    LOG       ┌──────────────┐
                             └──────────────────────┘ ───────────► │ n8n_webhook_ │
                                                                    │ executions   │
                                                                    └──────────────┘
                                                                          ▲
                                                                          │
                              ┌──────────────────────┐                    │
                              │ HoldingCentralTab    │ ────── lê ─────────┘
                              │  → aba "Webhooks"    │
                              └──────────────────────┘
```

**Por que webhook (push) e não polling?**
- n8n já dispara automaticamente quando os dados estão prontos → menor latência, sem cron extra do nosso lado
- Você já controla a frequência no n8n (1x ou 2x ao dia, ou quando quiser)
- Simples de adicionar mais fontes (Google Reviews, iFood, TripAdvisor) — cada uma vira um workflow no n8n apontando para o mesmo endpoint

---

## 1. Banco de dados (1 migration)

### Nova tabela `n8n_webhook_endpoints`
Cada endpoint representa uma "automação" do n8n (ex: "Google Reviews diário", "iFood 2x por dia").

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text | Ex: "Google Reviews — Diário" |
| `slug` | text unique | Identificador na URL (ex: `google-reviews-diario`) |
| `secret_token` | text | Token bearer para autenticar (gerado uma vez) |
| `tipo_dado` | text | `reclamacoes` (extensível futuramente) |
| `ativo` | boolean | Liga/desliga sem deletar |
| `loja_id_default` | uuid nullable | Se preenchido, força a loja (opcional) |
| `ultima_execucao_at` | timestamptz | |
| `total_recebido` | int default 0 | Contador acumulado |
| `created_at`, `updated_at` | timestamptz | |

RLS: apenas `admin` lê/escreve. O endpoint público bypassa RLS via service role.

### Nova tabela `n8n_webhook_executions`
Log de cada chamada vinda do n8n para auditoria/debug.

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `endpoint_id` | uuid FK |
| `status` | text (`success`, `partial`, `error`) |
| `payload_recebido` | jsonb |
| `linhas_processadas` | int |
| `linhas_inseridas` | int |
| `linhas_duplicadas` | int |
| `linhas_invalidas` | int |
| `erros` | jsonb |
| `created_at` | timestamptz |

RLS: leitura apenas para `admin`.

### Índice de deduplicação na `reclamacoes`
Para evitar duplicação quando o n8n reenviar:
```sql
CREATE UNIQUE INDEX idx_reclamacoes_dedupe
  ON public.reclamacoes (loja_id, fonte, data_reclamacao, md5(coalesce(texto_original, '')))
  WHERE fonte != 'manual';
```
Insert usará `ON CONFLICT DO NOTHING` para ser idempotente.

---

## 2. Edge Function: `ingest-reclamacoes`

**Path:** `POST /functions/v1/ingest-reclamacoes/{slug}`

### Autenticação
- `verify_jwt = false` no `config.toml` (n8n não tem JWT)
- Header obrigatório: `Authorization: Bearer <secret_token>`
- Token comparado com `n8n_webhook_endpoints.secret_token` (lookup pelo slug da URL)

### Payload aceito (JSON)
Aceita 1 reclamação ou um array — flexível para o n8n:
```json
{
  "reclamacoes": [
    {
      "loja": "Caju Limão Centro",        // nome → fuzzy match com config_lojas.nome
      "loja_id": "uuid-opcional",          // se já souber, evita match
      "fonte": "google",                   // google|ifood|tripadvisor|getin|sheets
      "tipo_operacao": "salao",            // salao|delivery
      "data_reclamacao": "2026-04-26",
      "nota_reclamacao": 2,
      "texto_original": "Demorou 40 min...",
      "resumo_ia": "Demora no atendimento", // opcional
      "temas": ["atendimento", "tempo"],    // opcional
      "palavras_chave": ["lento"],          // opcional
      "anexo_url": "https://..."            // opcional
    }
  ]
}
```

### Lógica
1. Valida bearer token → busca endpoint ativo pelo slug
2. Para cada reclamação:
   - Resolve `loja_id` (direto, ou via `loja_id_default`, ou fuzzy match no nome com `config_lojas`)
   - Calcula `referencia_mes` a partir de `data_reclamacao` (`YYYY-MM`)
   - Valida campos obrigatórios e enums (fonte, tipo_operacao, nota 1–5)
   - `INSERT ... ON CONFLICT DO NOTHING` em `reclamacoes`
3. Grava resumo em `n8n_webhook_executions` (sucesso/parcial/erro com detalhes por linha)
4. Atualiza `ultima_execucao_at` e `total_recebido` no endpoint
5. Retorna JSON: `{ success, processadas, inseridas, duplicadas, invalidas, erros }`

### Códigos HTTP
- `200` — processado (mesmo que algumas linhas falhem; detalhes no body)
- `401` — token inválido
- `404` — slug inexistente ou inativo
- `400` — payload malformado
- `500` — erro interno

---

## 3. UI — Nova aba "Webhooks n8n" no HoldingCentralTab

Ao lado das abas existentes (Upload de Dados, Sincronizações, etc.):

### Painel principal
- **Lista de endpoints** (tabela): nome, slug, fonte, status (ativo/inativo), última execução, total recebido, ações (copiar URL, copiar token, ver logs, editar, excluir)
- Botão **"+ Novo Endpoint Webhook"** abre modal com:
  - Nome (ex: "Google Reviews — Diário")
  - Slug (auto-gerado, editável)
  - Loja padrão (opcional, dropdown de `config_lojas`)
  - Switch ativo
  - Ao salvar: gera `secret_token` aleatório (32 bytes hex) e mostra **uma única vez** com botão de copiar + URL completa pronta para colar no n8n

### Card "Como configurar no n8n" (instruções inline)
```
URL:  https://<projeto>.supabase.co/functions/v1/ingest-reclamacoes/<slug>
Method: POST
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body: { "reclamacoes": [ {...} ] }
```
Com botão "Copiar exemplo de payload".

### Drawer "Histórico de execuções"
Ao clicar num endpoint, abre painel lateral com:
- Últimas 50 execuções (status badge, data, linhas inseridas/duplicadas/inválidas)
- Expandível: ver `payload_recebido` e `erros` (JSON formatado)
- Útil para debugar quando o n8n manda algo errado

---

## 4. Visualização automática (já pronta!)

Como as reclamações entram na tabela `reclamacoes` que já alimenta:
- `CentralReclamacoes` (lista detalhada)
- `useReclamacoes` (agregações por loja)
- `DiarioView` (gráfico diário de reclamações — recém criado)
- `AdminCXDashboard` (dashboard executivo CX)

…**a visualização aparece automaticamente** assim que o n8n envia. Sem trabalho extra de UI para os dashboards.

---

## 5. Arquivos a criar/alterar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/<novo>.sql` | Criar (2 tabelas + índice dedupe) |
| `supabase/functions/ingest-reclamacoes/index.ts` | Criar |
| `supabase/config.toml` | Adicionar `[functions.ingest-reclamacoes] verify_jwt = false` |
| `src/hooks/useN8nWebhooks.ts` | Criar (CRUD endpoints + executions) |
| `src/components/dashboard/N8nWebhooksSection.tsx` | Criar (UI completa da aba) |
| `src/components/dashboard/HoldingCentralTab.tsx` | Adicionar aba "Webhooks n8n" |

**Nada mais é tocado** — `useReclamacoes`, `CentralReclamacoes`, dashboards continuam intactos e ganham os dados automaticamente.

---

## 6. Segurança

- ✅ Token bearer único por endpoint (rotacionável — botão "regenerar token")
- ✅ Slug + token: dois fatores na URL, vazamento de um sozinho não autoriza
- ✅ RLS bloqueia acesso à tabela de endpoints/logs (somente admin)
- ✅ Edge function usa service role apenas internamente, nunca exposto
- ✅ Validação rigorosa de payload (enums, ranges, datas)
- ✅ Deduplicação no DB previne reenvios acidentais do n8n
- ⚠️ Sem rate limiting (limitação conhecida do Lovable Cloud) — mitigado por token secreto

---

## 7. Extensibilidade futura (não implementado agora, mas a arquitetura suporta)

- Adicionar `tipo_dado = 'store_performance'` ou `'auditoria'` no mesmo endpoint genérico
- Adicionar webhook outbound (notificar n8n quando uma reclamação grave entra)
- Filtrar execuções por status/data no histórico

---

## Pronto para executar?

Após aprovação, eu:
1. Crio a migration (você aprova as alterações de schema)
2. Crio a edge function e atualizo `config.toml`
3. Crio o hook e o componente de UI
4. Adiciono a aba no HoldingCentralTab
5. Te entrego a URL/token de exemplo para você plugar no n8n
