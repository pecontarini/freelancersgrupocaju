
## Diagnóstico

Executei uma auditoria no banco e encontrei **a causa-raiz de praticamente todos os erros da Stutz** (e de qualquer tenant que não seja CajuPAR):

**98 tabelas do schema `public` têm um `DEFAULT` fixo apontando para o `tenant_id` da CajuPAR (`8d4e0681-3ddd-4054-9034-4c01f596055c`).**

Como o `DEFAULT` da coluna é aplicado antes do trigger `set_tenant_id_from_context()`, a condição `IF NEW.tenant_id IS NULL` do trigger **nunca dispara**. Ou seja: sempre que um usuário Stutz insere uma linha sem passar `tenant_id` explicitamente, a linha entra com o `tenant_id` da Caju → a policy `tenant_isolation_restrictive` bloqueia com o erro exato mostrado no print (`new row violates row-level security policy "tenant_isolation_restrictive" for table "employees"`).

Isso explica também por que "vários problemas" aparecem simultaneamente: qualquer módulo que faça `INSERT` do lado do gestor Stutz (freelancer, escala, CMV, checklist, missão, manutenção, utensílios, etc.) esbarra no mesmo bloqueio.

Além disso, a Thaylla no print está tentando criar o freelancer a partir do "Completar cadastro" que abre o `FreelancerForm` → `useAddEmployee` (`INSERT` em `public.employees` sem `tenant_id`) — é exatamente esse caminho que quebra.

Tabelas afetadas incluem: `employees`, `freelancer_entries`, `freelancer_profiles`, `schedules`, `schedule_drafts`, `checklist_*`, `cmv_*`, `daily_budgets`, `daily_sales`, `maintenance_*`, `missoes` e todos seus filhos, `utensilios_*`, `sectors`, `setores`, `sector_job_titles`, `job_titles`, `config_lojas`, `config_funcoes`, `store_budgets`, `staffing_matrix`, `holding_*`, entre outras.

## Correção

### 1. Migração única: remover o DEFAULT hard-coded das 98 tabelas

Trocar `DEFAULT '8d4e0681...'::uuid` por sem default (DROP DEFAULT) em toda coluna `tenant_id` do schema `public`. O trigger `set_tenant_id_from_context` já cobre os dois caminhos válidos:

- **Tabelas com `unit_id`/`loja_id`** → resolve pelo `config_lojas` da loja.
- **Demais tabelas** → cai no fallback `current_tenant_id()` (retorna o tenant do usuário autenticado via `user_tenants`).

### 2. Estender o trigger para resolver via loja em mais tabelas

Hoje o trigger só resolve por unidade para `employees`. Vou generalizar: quando a tabela tiver uma coluna `unit_id` **ou** `loja_id` populada, buscar o `tenant_id` correspondente em `config_lojas`. Isso cobre `schedules`, `daily_budgets`, `daily_sales`, `freelancer_entries`, `checklist_responses`, `cmv_*`, `maintenance_entries`, `staffing_matrix`, etc.

### 3. Auditar cada RPC `SECURITY DEFINER` público da Stutz

Rodar smoke test em:
- `create_public_freelancer_request` (formulário `/solicitar-freela?tenant=stutz`) — confirmar que a linha entra com `tenant_id` da Stutz (a RPC hoje já resolve via loja, mas quero validar depois da migração).
- `list_public_units`, `list_public_sectors_and_jobs`, `verify_loja_pin`, `submit-daily-checklist`, `confirm-shift`, `escala-aprovacao-*`, `checkin-upload-photo`.

### 4. Smoke test end-to-end como usuário Stutz

Simular no banco os principais INSERTs com `SET LOCAL role = authenticated` e `request.jwt.claim.sub` do usuário Thaylla:
- criar `employees` (freelancer) na Santa Luzia Asa Sul,
- criar `freelancer_entries` manual,
- criar `schedules` + `schedule_draft_slots`,
- criar `daily_budgets` / `daily_sales`,
- criar `checklist_responses`,
- criar `maintenance_entries`,
- criar `missoes`.

Cada teste deve retornar sucesso e a linha inserida deve ter `tenant_id = 72221fb6-...` (Stutz). Se algum caminho falhar, corrijo o trigger ou o payload no frontend.

### 5. Refinar UX do formulário público `/solicitar-freela`

Ajuste rápido de UX pra reduzir o "não consigo avançar":
- Mensagem de erro específica no submit ("Faltou preencher: horário de início", etc.), em vez do genérico "Preencha todos os campos obrigatórios".
- Destacar o par `Horário de início` / `Horário final` com um subtítulo "Horário de serviço *" pra deixar claro que são obrigatórios.

## Detalhes técnicos

- Uma única migração SQL faz:
  1. `DO $$ ... EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id DROP DEFAULT', t) ...` iterando pelas 98 tabelas identificadas.
  2. `CREATE OR REPLACE FUNCTION public.set_tenant_id_from_context()` generalizado (unit_id / loja_id → `config_lojas` → tenant; fallback `current_tenant_id()`).
- Garantir que TODAS as tabelas listadas tenham esse trigger `BEFORE INSERT`. Hoje, `set_tenant_id_from_context` provavelmente existe só em algumas — vou anexar o trigger nas tabelas que faltarem.
- Nenhuma migração de dados é necessária: linhas antigas da Stutz que já foram criadas por super_admin com `tenant_id` correto continuam válidas.

## Fora de escopo

- Correções de estilo/UI que não afetam funcionamento.
- Findings pré-existentes do security linter não relacionados a tenant isolation.
