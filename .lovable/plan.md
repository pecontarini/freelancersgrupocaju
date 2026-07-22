## Objetivo

Criar uma página pública (sem login) onde qualquer solicitante possa registrar a necessidade de um freelancer. A solicitação já cria um "esqueleto" de lançamento em `freelancer_entries` (status pendente / dados incompletos), aparece numa fila para os gerentes da unidade completarem (nome, CPF, PIX, valor) e dispara notificações via in-app + email + botão wa.me.

## Fluxo do usuário

1. Solicitante acessa `/solicitar-freela` (link único global, sem login).
2. Escolhe **Unidade** (dropdown público das unidades ativas do tenant do link — via subdomínio/query `?t=slug`).
3. Preenche: Data da cobertura, Setor, Cargo (filtrado por setor da unidade), Motivo, Cobrindo quem, Solicitante responsável (nome + telefone livre).
4. Envia → cria registro pendente → mostra tela de sucesso + botão "Enviar WhatsApp aos gerentes" (wa.me pré-preenchido).
5. Gerentes da unidade recebem email + veem badge/lista "Solicitações pendentes" no portal.
6. Gerente abre a solicitação, completa nome/CPF/PIX/valor (reaproveita `EditFreelancerDialog`) → status vira "confirmado" e entra no fluxo normal de pagamento.

## O que será criado / alterado

### Banco

- Adicionar em `freelancer_entries`:
  - `status text default 'confirmado'` (novos registros públicos = `'pendente'`).
  - `solicitante_nome text`, `solicitante_telefone text`, `origem text default 'manual'` (público = `'publico'`).
  - Manter `cpf`, `chave_pix`, `valor`, `nome_completo` **nullable** apenas quando `status='pendente'` (validação via trigger).
- Nova RPC `public.create_public_freelancer_request(...)` `SECURITY DEFINER` que:
  - Recebe `tenant_slug`, `loja_id`, `data_pop`, `setor`, `funcao`, `motivo`, `substitui`, `solicitante_nome`, `solicitante_telefone`.
  - Valida que a unidade pertence ao tenant informado.
  - Insere em `freelancer_entries` com `status='pendente'`, `origem='publico'`, `tenant_id` derivado da unidade.
  - Retorna o `id` criado.
- `GRANT EXECUTE ... TO anon` apenas nessa função (tabela continua fechada por RLS).
- Nova RPC `public.list_public_units(tenant_slug)` `SECURITY DEFINER` para o dropdown público (retorna só `id`, `nome`) — grant a `anon`.
- Nova RPC `public.list_public_sectors_and_jobs(loja_id)` `SECURITY DEFINER` para setores/cargos públicos daquela unidade — grant a `anon`.

### Edge Function

`notify-freelancer-request`:
- Chamada pela RPC via `pg_net` (ou pelo frontend após insert bem-sucedido — mais simples).
- Lê a solicitação, resolve gerentes da unidade (roles `gerente_unidade`/`operator` em `user_stores` daquela loja).
- Envia email (Lovable Emails, template branded pelo tenant conforme `exportBranding`).
- Retorna também um `wame_url` pré-formatado para o frontend abrir.

### Frontend

- **Nova rota pública** `/solicitar-freela` em `App.tsx` (fora de `ProtectedRoute`).
- **Nova página** `src/pages/SolicitarFreela.tsx`:
  - Resolve tenant pelo subdomínio/query (reutiliza `tenantResolver`).
  - Aplica branding do tenant (logo Stutz/2Sell/etc.).
  - Formulário com os 5 campos obrigatórios + Unidade + Setor + Cargo (dependentes).
  - Tela de sucesso com botão wa.me.
- **Novo componente** `src/components/freelancer/SolicitacoesPendentes.tsx`:
  - Lista `freelancer_entries` com `status='pendente'` da unidade ativa.
  - Badge no menu lateral / dashboard de freelancers.
  - Botão "Completar cadastro" abre um dialog (variação de `EditFreelancerDialog`) exigindo nome, CPF, PIX, valor. Ao salvar, muda `status` para `'confirmado'`.
- **Ajustes**:
  - `EntriesTable` / `MobileFreelancerCard`: badge visual "Pendente" e ocultar dados vazios.
  - Exports (PDF/Excel): incluir apenas `status='confirmado'` por padrão, com filtro opcional para pendentes.
  - Página admin/config: botão "Copiar link público" que gera `https://<tenant>.2board.app/solicitar-freela`.

### Segurança

- RPCs `SECURITY DEFINER` com `SET search_path = public`, validam tenant e loja explicitamente.
- Rate limit simples: bloquear >5 requests do mesmo IP/loja em 10 min (via tabela `public_freelancer_request_log` opcional — incluída no plano).
- Nenhum dado sensível exposto ao anon: dropdown público só devolve nomes de unidades/setores/cargos, nunca IDs de employees ou telefones.

## Detalhes técnicos

- Notificação in-app: badge derivado de um `useQuery` em `freelancer_entries` filtrando `status='pendente'` — sem tabela nova.
- Email: usa template auth/transactional existente. Se infraestrutura de email ainda não estiver configurada no tenant, o envio falha silenciosamente e restam in-app + wa.me. Setup de email fica fora deste escopo (posso encaminhar depois se quiser).
- wa.me: usa `WaMeDispatcher` existente + template novo `FREELANCER_REQUEST_MESSAGE_V1` em `messageTemplates.ts` (assinado pelo Grupo/Tenant).
- Todas as novas colunas seguem o padrão `YYYY-MM-DD` para datas.

## Fora do escopo

- Configuração de domínio de email (se necessário, faço em passo separado).
- Aprovação/rejeição de solicitações (por ora, gerente apenas completa ou ignora).
- Histórico/analytics de solicitações públicas (fica para depois).
