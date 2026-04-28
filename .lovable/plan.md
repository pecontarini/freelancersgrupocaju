# Integração Banco Local → Supabase (Portal CajuPAR)

Objetivo: levar os dados que hoje vivem em um banco **local na máquina da loja** (sistema de PDV/retaguarda) para dentro do Supabase do Portal, com janela de atualização de **5 em 5 minutos**, de forma segura, auditável e idempotente.

Este documento serve como briefing para o **time de dados** executar a integração.

---

## 1. Arquitetura recomendada

Modelo: **Push do agente local → Edge Function de ingest → tabelas de staging → tabelas finais**.

Não expomos o banco local na internet. Não damos acesso direto do Supabase ao banco local. Quem fala é um **agente** (script/serviço) rodando na própria máquina, que empurra os dados para o Supabase via HTTPS.

```text
+----------------------+      every 5 min       +-------------------------+
|  Banco local (PDV)   |  ───────────────────►  |  Agente de sincronia    |
|  Postgres / MySQL /  |                        |  (Python/Node service)  |
|  SQL Server / Firebird|                       |  - lê delta             |
+----------------------+                        |  - assina payload       |
                                                |  - POST HTTPS           |
                                                +-----------+-------------+
                                                            │
                                                            ▼
                                          +-----------------------------------+
                                          | Supabase Edge Function            |
                                          | /functions/v1/ingest-local-db     |
                                          | - valida HMAC + token             |
                                          | - upsert em *_staging             |
                                          +-----------------+-----------------+
                                                            │
                                                            ▼
                                          +-----------------------------------+
                                          | Tabelas staging                   |
                                          | (vendas_staging, estoque_staging) |
                                          +-----------------+-----------------+
                                                            │ trigger / cron
                                                            ▼
                                          +-----------------------------------+
                                          | Tabelas finais já usadas pelo App |
                                          | daily_sales, inventory_transactions|
                                          | cmv_movements, etc.                |
                                          +-----------------------------------+
```

Por que staging antes da tabela final:
- isola erros do PDV (nomes de itens estranhos, duplicidades) sem corromper o dado de produção;
- permite o mesmo padrão de revisão/mapeamento que já usamos em `sheets_staging` e em `cmv_sales_mappings`;
- dá rastreabilidade (quando entrou, qual lote, qual hash).

---

## 2. O que o time de dados precisa entregar (agente local)

Um pequeno **serviço residente** na máquina onde está o banco local. Pode ser Python, Node ou .NET — o que o time de dados dominar. Requisitos:

1. **Roda como serviço** (Windows Service / systemd), reinicia sozinho.
2. **Conecta no banco local** em modo somente leitura.
3. **Lê apenas o delta** desde a última execução, usando uma das estratégias abaixo (em ordem de preferência):
   - coluna `updated_at` / `data_alteracao` na tabela origem;
   - tabela de log/auditoria do PDV;
   - se nenhuma existir: snapshot do dia + comparação por hash de linha.
4. **Persiste localmente o "cursor"** (último timestamp/ID enviado) num arquivo, para sobreviver a reinício.
5. **Empacota em JSON** e envia via HTTPS para a Edge Function de ingest.
6. **Trata falha de rede**: se cair, segura o lote e tenta de novo no próximo ciclo (idempotência garantida pelo `external_id` — ver seção 4).
7. **Janela**: a cada **5 minutos**, com jitter de ±20s para não bater todas as lojas no mesmo segundo.
8. **Logs locais** com retenção mínima de 7 dias.

Entregáveis do time de dados:
- código-fonte do agente versionado em Git;
- instalador/script de deploy para cada loja;
- documento "como instalar em uma loja nova";
- dashboard simples de saúde (última execução, último erro) — pode ser uma tabela `agent_heartbeats` no próprio Supabase.

---

## 3. O que vamos entregar do lado Supabase (Portal)

### 3.1 Tabelas de staging
Uma por domínio de dado. Mínimo inicial:

- `pdv_vendas_staging` — itens vendidos por dia/hora.
- `pdv_estoque_staging` — saídas/entradas/ajustes do estoque do PDV (se houver).
- `pdv_recebimento_staging` — notas/recebimentos (se houver).
- `agent_heartbeats` — saúde do agente por loja.
- `agent_ingest_log` — histórico de cada lote recebido (`source`, `loja_id`, `linhas`, `hash_lote`, `recebido_em`, `processado_em`, `erro`).

Cada linha de staging carrega: `external_id` (chave do PDV), `loja_id`, payload bruto + colunas tipadas, `hash`, `received_at`, `processed_at`, `processed boolean`, `error_message`.

### 3.2 Edge Function `ingest-local-db`
- Pública (sem `verify_jwt`), mas autenticada por:
  - **token por loja** (header `X-Loja-Token`) — armazenado em `secrets`;
  - **assinatura HMAC** do corpo (header `X-Signature`) com chave compartilhada;
  - **whitelist de IP** opcional, se o time de dados informar IPs fixos das lojas.
- Validação de payload com Zod.
- Upsert em staging usando `external_id + loja_id` como chave única → idempotente.
- Atualiza `agent_heartbeats` (último ping, versão do agente).
- Devolve `{ ok, recebidos, ignorados_duplicados }`.

### 3.3 Promotor staging → produção
- Função SQL `promote_pdv_staging(p_loja_id uuid)` chamada por **pg_cron a cada 5 min** (ou trigger `AFTER INSERT` em staging).
- Para vendas: faz match com `cmv_sales_mappings` e insere em `daily_sales` + `inventory_transactions (sale_deduction)`.
- Itens sem mapeamento vão para `cmv_pending_sales_items` (já existe), onde o gestor resolve no painel — mesmo fluxo atual do Google Sheets.
- Marca a linha de staging como `processed = true`.

### 3.4 Painel de monitoramento no Portal
Uma aba dentro do CMV/Configurações ("Sincronização PDV") mostrando:
- Por loja: última sincronização, atraso em minutos, status do agente.
- Lote bruto recebido (últimos 50).
- Itens pendentes de mapeamento.
- Botão "Reprocessar staging".

---

## 4. Contrato de payload (o que o agente envia)

Mesmo formato para todas as lojas. Exemplo de uma chamada de vendas:

```json
POST https://munehfraeisxfvpplkfi.supabase.co/functions/v1/ingest-local-db
Headers:
  Content-Type: application/json
  X-Loja-Token: <token único por loja>
  X-Signature: sha256=<HMAC do body com a secret da loja>
  X-Agent-Version: 1.0.3

Body:
{
  "loja_id": "effdbb9e-f0ea-43ee-8845-f02bbbc94703",
  "tipo": "vendas",
  "lote_id": "2026-04-28T18:05:00Z-001",
  "gerado_em": "2026-04-28T18:05:00Z",
  "cursor_ate": "2026-04-28T18:00:00Z",
  "itens": [
    {
      "external_id": "VENDA-883421-3",
      "data_venda": "2026-04-28",
      "hora_venda": "17:42:11",
      "item_nome": "PICANHA 250G",
      "quantidade": 2,
      "valor_total": 198.00
    }
  ]
}
```

Regras:
- `external_id` é único e estável no PDV — é a chave anti-duplicação.
- `loja_id` vem do `config_lojas` do Portal (entregamos a tabela de lojas para o time de dados).
- HMAC garante que ninguém forja request mesmo conhecendo o token.

---

## 5. Mapeamento de loja e segurança

- Para cada loja, geramos no Portal:
  - `loja_token` (UUID público)
  - `loja_secret` (32 bytes, usado no HMAC)
- Esses dois valores ficam no agente local (arquivo `.env` no servidor da loja, somente leitura para o serviço).
- Rotação dos tokens fica disponível em "Sincronização PDV → Lojas".

---

## 6. Tratamento de erros e reprocessamento

- Falha de rede no agente → o lote fica na fila local e é reenviado.
- Falha de validação na Edge Function → retorna 400 com detalhe; o agente loga e **não avança o cursor**.
- Falha no promotor SQL → linha de staging fica com `processed = false` e `error_message` preenchido; aparece no painel com botão "Reprocessar".
- Reimportação manual: o time de dados pode rodar o agente em modo `--backfill --from=YYYY-MM-DD` que envia o histórico marcando o mesmo `external_id` (idempotente).

---

## 7. Plano de implantação sugerido

| Fase | Entrega | Responsável |
|---|---|---|
| 1 | Schema de staging + Edge Function `ingest-local-db` + painel mínimo | Lovable |
| 2 | Geração de tokens por loja + documentação do contrato (este doc) | Lovable |
| 3 | Agente local (PoC) rodando em **uma loja piloto** (Mult14) | Time de dados |
| 4 | Validação 7 dias: comparar relatório do PDV × `daily_sales` no Portal | Conjunto |
| 5 | Roll-out para demais lojas (Caju, Caminito, Nazo, Foster's) | Time de dados |
| 6 | Ligar promotor automático (pg_cron 5 min) e desligar import manual de vendas | Lovable |

---

## 8. Perguntas para o time de dados (precisamos das respostas antes de codar a Fase 1)

1. Qual SGBD roda na máquina local? (Postgres / MySQL / SQL Server / Firebird / outro)
2. As tabelas de venda têm coluna `updated_at` confiável?
3. Qual a granularidade desejada: item de venda, cupom, ou agregado por dia?
4. Além de vendas, queremos puxar também: estoque, recebimento de NF, descartes?
5. As máquinas das lojas têm saída HTTPS liberada para `*.supabase.co`?
6. Existe IP fixo por loja (para whitelist opcional)?
7. Tem alguém na loja para instalar o serviço, ou o time de dados acessa remoto?

---

## 9. O que NÃO vamos fazer (e por quê)

- **Não** abrir porta do banco local para a internet — superfície de ataque enorme.
- **Não** usar replicação lógica do Postgres direto para o Supabase — exige VPN/peering, e nem todos os PDVs são Postgres.
- **Não** depender do Google Sheets como ponte (fluxo atual) — adiciona latência de horas e ponto único de falha humana.
- **Não** deixar o agente escrever direto em `daily_sales` — passa sempre por staging para preservar o padrão de revisão obrigatória (memória do projeto: "import confirmation standard").

---

## Resumo executivo (para enviar ao time de dados)

> Vamos sincronizar o banco local de cada loja com o Portal CajuPAR a cada 5 minutos.
> O time de dados constrói um **agente residente** na máquina da loja que lê o delta e faz `POST` autenticado (token + HMAC) para uma Edge Function nossa.
> Nós entregamos o endpoint, o contrato JSON, as tabelas de staging, o promotor para produção e o painel de monitoramento.
> Piloto na Mult14, validação por 7 dias, depois roll-out.

Posso seguir com a Fase 1 (schema de staging + Edge Function de ingest + painel de monitoramento + geração de tokens por loja)?
