## Plano: Checklist Diario de Autoavaliacao para Chefes de Setor

### Visao Geral

O admin faz upload dos 4 PDFs de checklist dos supervisores. A IA extrai TODOS os itens com os pesos, sem se preocupar se naquele dia o item foi conforme ou não conforme. A ideia é ter todos . O admin mapeia manualmente cada item a um setor. O sistema gera checklists individuais por setor. Cada chefe recebe um link exclusivo (sem login) para aplicar diariamente o checklist do seu setor, e o sistema calcula a nota usando os mesmos pesos do checklist do supervisor e salva automáticamente naquela data o resultado e a nota que seria aplicada no seu setor. 

---

### Fluxo Completo

```text
ADMIN                          SISTEMA                        CHEFE
  |                               |                              |
  |-- Upload 4 PDFs ------------->|                              |
  |                               |-- IA extrai TODOS os itens   |
  |<-- Lista de itens extraidos --|                              |
  |                               |                              |
  |-- Mapeia item -> setor ------>|                              |
  |   (interface drag/select)     |-- Salva mapeamento           |
  |                               |                              |
  |-- Ativa checklist ----------->|-- Gera links por setor       |
  |                               |                              |
  |                               |         Link exclusivo ----->|
  |                               |                              |-- Abre checklist mobile
  |                               |                              |-- Marca Sim/Nao por item
  |                               |                              |-- Envia
  |                               |<-- Salva respostas ----------|
  |                               |-- Calcula nota               |
  |                               |                              |
  |<-- Dashboard com notas -------|                              |
```

---

### Modelo de Dados (Migracao)

**Tabela `checklist_templates**` - Os 4 checklists do supervisor


| Campo          | Tipo        | Descricao                     |
| -------------- | ----------- | ----------------------------- |
| id             | uuid PK     | &nbsp;                        |
| loja_id        | uuid FK     | Unidade vinculada             |
| name           | text        | Ex: "Checklist Supervisor 1"  |
| source_pdf_url | text        | URL do PDF original           |
| is_active      | boolean     | Se esta ativo para uso diario |
| created_by     | uuid        | Admin que criou               |
| created_at     | timestamptz | &nbsp;                        |


**Tabela `checklist_template_items**` - Cada pergunta extraida


| Campo             | Tipo        | Descricao                                 |
| ----------------- | ----------- | ----------------------------------------- |
| id                | uuid PK     | &nbsp;                                    |
| template_id       | uuid FK     | Referencia ao template                    |
| item_text         | text        | Texto da pergunta                         |
| item_order        | integer     | Ordem no checklist                        |
| weight            | numeric     | Peso do item (default 1)                  |
| sector_code       | text        | Setor mapeado (nullable ate admin mapear) |
| original_category | text        | Categoria original do PDF                 |
| created_at        | timestamptz | &nbsp;                                    |


**Tabela `checklist_sector_links**` - Links exclusivos por setor/chefe


| Campo        | Tipo        | Descricao                   |
| ------------ | ----------- | --------------------------- |
| id           | uuid PK     | &nbsp;                      |
| loja_id      | uuid FK     | &nbsp;                      |
| sector_code  | text        | Ex: 'bar', 'cozinha'        |
| access_token | text UNIQUE | Token aleatorio para o link |
| is_active    | boolean     | &nbsp;                      |
| created_at   | timestamptz | &nbsp;                      |


**Tabela `checklist_responses**` - Cada aplicacao diaria


| Campo             | Tipo        | Descricao                  |
| ----------------- | ----------- | -------------------------- |
| id                | uuid PK     | &nbsp;                     |
| link_id           | uuid FK     | Referencia ao sector_link  |
| loja_id           | uuid FK     | &nbsp;                     |
| sector_code       | text        | &nbsp;                     |
| response_date     | date        | Data da aplicacao          |
| total_score       | numeric     | Nota calculada (0-100)     |
| total_items       | integer     | Total de itens respondidos |
| conforming_items  | integer     | Itens marcados como "Sim"  |
| responded_by_name | text        | Nome de quem aplicou       |
| created_at        | timestamptz | &nbsp;                     |


**Tabela `checklist_response_items**` - Resposta de cada item


| Campo            | Tipo        | Descricao           |
| ---------------- | ----------- | ------------------- |
| id               | uuid PK     | &nbsp;              |
| response_id      | uuid FK     | &nbsp;              |
| template_item_id | uuid FK     | &nbsp;              |
| is_conforming    | boolean     | Sim/Nao             |
| observation      | text        | Comentario opcional |
| photo_url        | text        | Foto de evidencia   |
| created_at       | timestamptz | &nbsp;              |


**RLS**: 

- Admins e operators: acesso total
- Gerentes de unidade: acesso a suas lojas
- As tabelas de resposta permitem INSERT sem autenticacao (via service role na edge function), pois os chefes acessam por link publico

---

### Arquivos Novos

**1. Edge Function: `supabase/functions/extract-checklist-items/index.ts**`

- Recebe PDF base64, usa IA (Gemini) para extrair TODOS os itens do checklist 
- Prompt diferente do `process-checklist-pdf`: aqui extrai todos os itens com seus pesos/pontuacoes
- Retorna: lista de itens com texto, categoria original, peso

**2. Edge Function: `supabase/functions/submit-daily-checklist/index.ts**`

- Endpoint publico (sem JWT) acessado pelo link do chefe
- Acoes:
  - `fetch`: recebe access_token, retorna itens do setor para preencher
  - `submit`: recebe respostas, calcula nota, salva tudo
- Calcula a nota usando peso de cada item: `(soma_pesos_conformes / soma_total_pesos) * 100`

**3. Pagina publica: `src/pages/DailyChecklist.tsx**`

- Acessada via `/checklist/:accessToken` (sem login necessario, igual ao ConfirmShift)
- UI mobile-first:
  - Cabecalho: logo, nome do setor, data de hoje
  - Campo "Seu nome" para identificacao
  - Lista de itens com toggle Sim/Nao (Switch) + campo observacao opcional + botao foto
  - Barra de progresso mostrando quantos itens foram respondidos
  - Botao "Enviar Checklist"
  - Tela de sucesso com a nota calculada

**4. Componente admin: `src/components/checklist-daily/ChecklistTemplateManager.tsx**`

- Interface para o admin:
  - Upload de PDFs dos 4 checklists
  - Lista de itens extraidos pela IA
  - Para cada item: dropdown para selecionar o setor (usando a lista de setores do `SECTOR_POSITION_MAP`)
  - Botoes "Mapear Todos Automaticamente" (usa keywords) e "Limpar Mapeamento"
  - Definicao de peso por item (editavel)
  - Botao "Ativar Checklist" que gera os links por setor

**5. Componente admin: `src/components/checklist-daily/ChecklistLinksPanel.tsx**`

- Mostra os links gerados por setor
- Botao de copiar link e enviar via WhatsApp
- Status: ativo/inativo
- Historico de respostas por setor (ultimos 7 dias com nota)

**6. Componente admin: `src/components/checklist-daily/ChecklistResponsesDashboard.tsx**`

- Dashboard com:
  - Calendario mostrando dias com checklist aplicado (verde) e sem (vermelho)
  - Grafico de evolucao de nota por setor ao longo dos dias
  - Comparativo: nota do checklist diario vs nota do supervisor
  - Tabela de respostas com drill-down por item

**7. `src/components/checklist-daily/index.ts**` - Barrel exports

**8. Rota no `App.tsx**`

- Adicionar `/checklist/:accessToken` como rota publica (igual ao `/confirm-shift/:scheduleId`)

---

### Arquivos Editados


| Arquivo                                                 | Mudanca                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| `src/App.tsx`                                           | Nova rota `/checklist/:accessToken`               |
| `src/components/dashboard/AuditDiagnosticDashboard.tsx` | Novo tab "Checklist Diario"                       |
| `supabase/config.toml`                                  | verify_jwt = false para as 2 novas edge functions |


---

### UI/UX Detalhada

**Tela do Chefe (mobile, sem login):**

```text
[Logo Grupo Caju]

CHECKLIST DIARIO - BAR
Unidade: Caju Asa Sul
24 de Fevereiro, 2026 (Segunda-feira)

Seu nome: [___________________]

--- Progresso: 12/28 itens ---
[============================........] 43%

1. As bebidas estao na temperatura correta?
   [SIM] [NAO]  + Observacao  + Foto

2. O balcao do bar esta limpo e organizado?
   [SIM] [NAO]  + Observacao  + Foto

3. Os copos estao higienizados?
   [SIM] [NAO]  + Observacao  + Foto

...

[========= ENVIAR CHECKLIST =========]
```

**Tela de sucesso apos envio:**

```text
[Logo]

Checklist Enviado!

NOTA DO DIA: 85%

Bar - Caju Asa Sul
24/02/2026

Itens conformes: 24/28
Itens nao conformes: 4

Obrigado pela aplicacao!
```

**Painel Admin - Gestao de Templates:**

```text
CHECKLIST DIARIO | Templates | Links | Respostas

[Upload PDF] [Mapear Automaticamente]

Template: Checklist Supervisor Fiscal
42 itens extraidos | 38 mapeados | 4 pendentes

| # | Item                              | Setor        | Peso |
|---|-----------------------------------|--------------|------|
| 1 | Temperatura da geladeira...       | [Cozinha v]  | 1.0  |
| 2 | Limpeza do balcao do bar...       | [Bar v]      | 1.0  |
| 3 | Organizacao das mesas...          | [Salao v]    | 1.0  |
| 4 | Validade dos produtos no estoque  | [Estoque v]  | 1.5  |
```

**Painel Admin - Links por Setor:**

```text
| Setor     | Link                              | Status | Ultima Resp. | Nota |
|-----------|-----------------------------------|--------|--------------|------|
| Bar       | /checklist/abc123...  [Copiar][WA] | Ativo  | Hoje 09:30   | 85%  |
| Cozinha   | /checklist/def456...  [Copiar][WA] | Ativo  | Hoje 09:45   | 92%  |
| Salao     | /checklist/ghi789...  [Copiar][WA] | Ativo  | Ontem        | 78%  |
| Parrilla  | /checklist/jkl012...  [Copiar][WA] | Ativo  | --           | --   |
```

---

### Detalhes Tecnicos

**Extracao de itens pela IA:**

- Prompt diferente do atual: extrai TODOS os itens (nao so as falhas), incluindo peso/pontuacao de cada um
- Retorna array de `{ item_text, category, weight, item_order }`
- Usa `google/gemini-2.5-pro` para maior precisao na extracao

**Mapeamento automatico:**

- Usa a funcao `categorizeItemToSector()` existente para sugerir o setor
- O admin pode sobrescrever manualmente

**Calculo da nota:**

- Identico ao do supervisor: `(soma_pesos_conformes / soma_total_pesos) * 100`
- Se todos os itens tem peso 1, e uma simples porcentagem de conformidade

**Links publicos:**

- Token UUID aleatorio por setor/loja: `/checklist/f47ac10b-58cc-4372-a567-0e02b2c3d479`
- Edge function valida o token e retorna os itens
- Sem necessidade de login (mesmo padrao do ConfirmShift)

---

### Ordem de Implementacao

1. **Migracao de banco** (5 tabelas + RLS + indexes)
2. **Edge function `extract-checklist-items**` (extracao IA)
3. **Edge function `submit-daily-checklist**` (fetch + submit)
4. **Componentes admin** (TemplateManager, LinksPanel, ResponsesDashboard)
5. **Pagina publica** (DailyChecklist.tsx)
6. **Integracao no dashboard** (novo tab no AuditDiagnosticDashboard)
7. **Rota no App.tsx**