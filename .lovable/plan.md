## Objetivo
Cadastrar todos os funcionários ativos do PDF **CADASTRO_ATIVOS_-_HSL_24.07.2026.PDF** (HOTTI ALIMENTAÇÃO / HSL) diretamente na tabela `employees`, vinculados à unidade **SANTA LUZIA ASA SUL** (Stutz), para aparecerem automaticamente no criador de escalas.

## O que será feito

### 1. Parse do PDF (fora do banco)
Extrair as ~110 linhas do PDF em CSV com as colunas: `nome`, `telefone`, `cargo_texto`, `admissao`, `cpf`.
Limpezas:
- CPF: só dígitos (11)
- Telefone: só dígitos com DDD
- Nome: Title Case
- Gênero: heurística por terminação do primeiro nome (`a`/`e` femininos comuns → F; senão M). Como o campo é obrigatório, essa é a melhor aproximação — pode ser corrigida na UI depois.

### 2. Normalização e criação dos cargos
Os cargos do PDF chegam com muitas variações do mesmo papel. Vou consolidar:

| Grupo canônico | Variantes do PDF |
|---|---|
| COPEIRO(A) HOSPITALAR | COPEIRO HOSPITALAR, COPEIRA HOSPITALAR, COPEIRO(A) HOSPITALAR, COPEIRO(A), COPEIRA, COPEIRO |
| GARÇOM | GARCOM, GARCONETE |
| AUXILIAR DE COZINHA | AUX DE COZINHA, AUXILIAR COZINHA, AUXILIAR DE COZINHA |
| AUXILIAR DE SERVIÇOS GERAIS | AUX DE SERV. GERAIS, AUX DE SERV GERAIS, AUX. DE SERV GERAIS, AUXILIAR DE SERVIÇOS |
| AUXILIAR DE ESTOQUE | AUXILIAR DE ESTOQUE |
| CONCIERGE | CONCIERGE, CONCIERGE NIVEL I, SUPERVISOR DE CONCIERGE |
| TÉCNICO DE NUTRIÇÃO | TEC. EM NUTRICAO, TECNICO DE NUTRICAO, TECNICO EM NUTRICAO, TECNICA DE NUTRIÇÃO, TEC EM NUTRI HOSPITALAR |
| NUTRICIONISTA | NUTRICIONISTA, NUTRICIONISTA DE |
| COZINHEIRO(A) HOSPITALAR | COZINHEIRA HOSPITAR, COZINHEIRO HOSPITALAR, COZINHEIRO GERAL |
| AUXILIAR ADMINISTRATIVO | ASSISTENTE ADMINISTRATIVO, AUXILIAR ADMINISTRATIVO, AUX. ADMINISTRATIVO, ASSIS DE PLANEJAMENTO |
| SALADEIRA | SALADEIRA |
| CONFEITEIRA | CONFEITEIRA, AUX DE CONFEITARIA |
| ENCARREGADO | ENCARREGADO, ENCARREGADA DE |
| SUPERVISORA DE PRODUÇÃO | SUPERVISORA DE PRODUÇÃO |

Cargos que já existem no banco para SLAS (COPEIRO(A), GARÇOM, AUXILIAR DE COZINHA, AUXILIAR DE SERVIÇOS GERAIS, ESTOQUE, ADMINISTRATIVO, TECNICO DE NUTRIÇÃO, NUTRICIONISTA, COZINHA) serão reaproveitados. Os que faltam serão criados em `job_titles` com `unit_id = SLAS` e `tenant_id = Stutz`.

### 3. Inserção em `employees`
Para cada linha:
- `unit_id` = `e2ad5403-dcfb-4a70-a9cc-15106bb348f5` (SANTA LUZIA ASA SUL)
- `tenant_id` resolvido automaticamente pelo trigger a partir do `unit_id`
- `worker_type = 'clt'`
- `banco_id` e `secullum_id` fictícios (par único a partir de 900001) — satisfaz o trigger guardião e a unique constraint `employees_banco_secullum_unique`
- `aguardando_secullum = false` (para o funcionário aparecer no `useSchedulableEmployees`)
- `active = true`
- `cpf` (11 dígitos), `phone`, `name`, `gender`, `job_title` (texto), `job_title_id`

Duplicidades: se um CPF já existir na unidade, o registro é ignorado (`ON CONFLICT DO NOTHING` via CPF).

### 4. Entregáveis
- Migração idempotente que cria os cargos faltantes.
- Insert em massa (via ferramenta de dados) com os ~110 funcionários.
- Relatório final com: total inseridos, ignorados por CPF duplicado, cargos criados.

## Riscos e o que fica pendente
- **IDs Secullum fictícios**: quando o Secullum real for conectado, será preciso rodar um match por CPF (função `find_employee_by_secullum_id` já existe) e substituir os IDs — senão haverá duplicidade. Recomendo manter isso na dívida técnica.
- **Gênero por heurística**: alguns podem ficar errados; o gestor corrige na tela de funcionários.
- **Data de admissão**: a tabela `employees` não tem esse campo. O valor do PDF será descartado (fica apenas o `created_at` atual). Se você quiser preservar, precisamos adicionar a coluna antes.

## Detalhes técnicos
- Trigger `set_tenant_id_from_context` resolve o `tenant_id` a partir do `unit_id`.
- Trigger guardião exige `worker_type='clt'` **e** (`banco_id` + `secullum_id` não nulos) **ou** `aguardando_secullum=true`. Vamos pela primeira via.
- `useSchedulableEmployees` (usado pelo criador de escalas) filtra: `active=true`, `worker_type='clt'`, `banco_id NOT NULL`, `secullum_id NOT NULL`, `aguardando_secullum` nulo/false — todos os inseridos atenderão.
- Unicidade: `unique_active_employee_no_cpf` protege duplicatas por (unidade, nome, cargo) quando CPF ausente; como todo funcionário do PDF tem CPF, esse índice não bloqueará.

Confirma para eu executar?
