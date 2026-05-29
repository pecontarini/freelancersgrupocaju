## Diagnóstico confirmado

- A escala já filtra corretamente para mostrar apenas funcionários sincronizados do Secullum: `worker_type='clt'`, `banco_id IS NOT NULL`, `secullum_id IS NOT NULL`, `aguardando_secullum=false`.
- Em Caju Itaim existem hoje **113 CLTs sincronizados** visíveis para escala.
- Os nomes citados anteriormente foram cadastrados manualmente como `freelancer`, sem `banco_id`, sem `secullum_id` e sem `sincronizado_em`; por isso não aparecem na escala.
- Se esses funcionários realmente existem no Secullum, o problema mais provável não é o editor: é a reconciliação/importação do sync não estar trazendo ou não estar vinculando esses CPFs à unidade Caju Itaim.

## Objetivo

Garantir que **somente cadastros originados do sync Secullum** apareçam no editor, e corrigir os cadastros que são do Secullum mas não aparecem sem abrir brecha para cadastro manual comum entrar na escala.

## Plano de execução

### 1. Auditar a função de sync de funcionários Secullum

Revisar a função de banco `sync_funcionarios_secullum(p_payload jsonb)`, que hoje:

- recebe funcionários do payload externo;
- identifica unidade por `Empresa.Documento` comparando com `config_lojas.cnpj`;
- grava/atualiza `employees` por conflito em `(banco_id, secullum_id)`;
- marca funcionários válidos como:
  - `worker_type='clt'`
  - `banco_id=75820`
  - `secullum_id=<Id do Secullum>`
  - `aguardando_secullum=false`
  - `sincronizado_em=now()`

Ponto crítico a validar: se o funcionário existe no Secullum mas vem com CNPJ diferente, CNPJ sem mapeamento, demissão preenchida, ou payload incompleto, ele não entra na unidade e nunca aparece no editor.

### 2. Criar diagnóstico seguro para CPFs/nome sem mexer em schema

Adicionar uma consulta/relatório de reconciliação para os CPFs manuais ativos em Caju Itaim:

- listar registros manuais ativos sem `secullum_id`;
- cruzar por CPF com qualquer registro Secullum já existente em `employees`;
- apontar status:
  - `ja_sincronizado_mesma_unidade`
  - `sincronizado_outra_unidade`
  - `manual_sem_correspondente_local`
  - `duplicado_manual_vs_secullum`

Se não houver registro Secullum correspondente na tabela `employees`, isso indica que o sync ainda não recebeu/processou esse CPF no painel, mesmo que ele exista no sistema Secullum externo.

### 3. Corrigir a função de sync para reconciliar CPF manual com Secullum

Atualizar `sync_funcionarios_secullum` para, antes de inserir um novo CLT sincronizado, tentar reconciliar um cadastro manual ativo da mesma unidade pelo CPF limpo.

Regra proposta:

- Se chegar funcionário ativo do Secullum com `CPF` válido e `unit_id` mapeado:
  - procurar em `employees` um registro ativo na mesma unidade, mesmo CPF, sem `secullum_id`;
  - se existir, atualizar esse registro para virar o cadastro canônico Secullum:
    - `worker_type='clt'`
    - `banco_id=75820`
    - `secullum_id=<Id>`
    - `name`, `job_title`, `phone`, `gender`, `unit_id` vindos do Secullum
    - `aguardando_secullum=false`
    - `sincronizado_em=now()`
  - se não existir, manter o fluxo atual de insert/upsert por `(banco_id, secullum_id)`.

Isso preserva a regra: o funcionário só passa a aparecer quando o **Secullum confirmou** `banco_id/secullum_id`.

### 4. Não liberar cadastro manual na escala

Não alterar `useSchedulableEmployees` para incluir freelancers ou manuais.

Manter o filtro como está:

```ts
active=true
worker_type='clt'
banco_id not null
secullum_id not null
aguardando_secullum is false/null
```

Isso evita bagunçar backend e impede que cadastro manual comum entre na grade.

### 5. Ajustar UX para evitar novos cadastros manuais confundidos com Secullum

Alterar somente mensagens/fluxo visual onde necessário:

- `TeamManagement.tsx`: deixar claro que “Equipe” lista cadastros gerais, mas a escala usa apenas CLTs sincronizados do Secullum.
- `QuickCreateEmployeeModal.tsx`: reforçar que cadastro urgente/manual não entra na escala fixa até ser reconciliado pelo sync.
- `SchedulableEmptyState.tsx`: manter mensagem focada em Secullum e incluir orientação para conferir se o CPF/CNPJ da unidade está chegando no sync.

Sem mudança de schema e sem liberar manual na escala.

### 6. Limpeza dos cadastros órfãos atuais

Após a correção da reconciliação, tratar os cadastros manuais de Caju Itaim de forma conservadora:

- não deletar;
- se o sync reconciliar por CPF, eles viram CLT canônico automaticamente;
- se não reconciliar, continuam fora da escala;
- opcionalmente, inativar manualmente os órfãos confirmados que não existem no Secullum.

A inativação só deve acontecer após confirmar quais CPFs realmente não chegaram pelo sync.

## Arquivos/tabelas envolvidos

### Banco

- Função: `public.sync_funcionarios_secullum(p_payload jsonb)`
- Tabela: `public.employees`
- Tabela de loja: `public.config_lojas`
- Log: `public.sync_secullum_log`

### Frontend

- `src/hooks/useEmployees.ts`
  - manter filtro de `useSchedulableEmployees`.
- `src/components/escalas/TeamManagement.tsx`
  - mensagem preventiva.
- `src/components/escalas/QuickCreateEmployeeModal.tsx`
  - mensagem preventiva para cadastro urgente/manual.
- `src/components/escalas/SchedulableEmptyState.tsx`
  - orientação de diagnóstico Secullum.

## Validação esperada

1. Confirmar que o editor continua usando apenas `useSchedulableEmployees`.
2. Confirmar que `useSchedulableEmployees` continua exigindo `banco_id` e `secullum_id`.
3. Rodar query de auditoria em Caju Itaim:
   - total ativos;
   - total CLT Secullum;
   - manuais sem `secullum_id`;
   - duplicados por CPF.
4. Validar função de sync com payload de exemplo contendo um CPF que já existe manualmente:
   - antes: manual não aparece;
   - depois do sync: mesmo registro recebe `banco_id/secullum_id`, vira `clt`, aparece na escala.
5. Verificar que nenhum freelancer/manual sem `secullum_id` aparece no editor.

## Riscos controlados

- Não altera RLS.
- Não cria tabela nova.
- Não muda regra de escala.
- Não apaga dados.
- Não transforma cadastro manual em escalável sem confirmação do Secullum.
- Corrige apenas a reconciliação quando o Secullum enviar o funcionário.