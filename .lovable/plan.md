
## Problema identificado

A usuária tentou cadastrar uma funcionária **ANA (SUBCHEFE)** na MULT 02 - NAZO GO e recebeu:

> Erro ao salvar: duplicate key value violates unique constraint "unique_active_employee_no_cpf"

**Causa:** já existe uma **ANA (CUMIM)** ativa sem CPF nessa mesma unidade. O índice único atual no banco proíbe dois funcionários ativos com o mesmo nome quando ambos estão sem CPF:

```sql
CREATE UNIQUE INDEX unique_active_employee_no_cpf
ON public.employees (unit_id, lower(trim(name)))
WHERE active = true AND (cpf IS NULL OR cpf = '');
```

Esse constraint foi pensado para evitar duplicatas acidentais, mas é restritivo demais para a realidade operacional — é comum ter dois colaboradores com o mesmo primeiro nome (ex.: ANA SILVA e ANA COSTA), e nem sempre o CPF está disponível no momento do cadastro inicial.

Além disso, a mensagem de erro mostrada hoje é técnica (texto bruto da Postgres) e não orienta o usuário sobre o que fazer.

## Plano de correção

### 1. Substituir o constraint rígido por um soft-warning (migration)

Remover o índice atual `unique_active_employee_no_cpf` e substituir por uma versão baseada em **(unit_id, name, job_title)** — assim duas pessoas com o mesmo primeiro nome só serão bloqueadas se também tiverem o **mesmo cargo**, o que é um indicador muito mais confiável de duplicata acidental:

```sql
DROP INDEX IF EXISTS public.unique_active_employee_no_cpf;

CREATE UNIQUE INDEX unique_active_employee_no_cpf
ON public.employees (unit_id, lower(trim(name)), lower(coalesce(trim(job_title), '')))
WHERE active = true AND (cpf IS NULL OR cpf = '');
```

Isso libera o caso da usuária (ANA CUMIM ≠ ANA SUBCHEFE) e ainda protege contra cadastros duplicados óbvios. O índice de freelancer com CPF (`unique_freelancer_cpf_unit`) permanece intocado.

### 2. Tradução amigável de erros nos 3 hooks de mutação (`useEmployees.ts`)

Atualmente o `onError` apenas concatena `err.message`. Vou adicionar um helper `friendlyEmployeeError(err)` em `useEmployees.ts` que detecta os códigos/mensagens conhecidos do Postgres e devolve textos claros em português:

- `unique_active_employee_no_cpf` → "Já existe um funcionário com este nome e cargo nesta unidade. Adicione um sobrenome ou informe o CPF para diferenciar."
- `unique_freelancer_cpf_unit` → "Este CPF já está cadastrado como freelancer nesta unidade."
- Demais erros caem no fallback `err.message`.

Aplicar nos 3 hooks: `useAddEmployee`, `useUpdateEmployee`, `useDeleteEmployee`.

### 3. Tratamento defensivo no formulário de cadastro (`TeamManagement.tsx`)

No `handleSubmit`, antes de chamar `addEmployee.mutateAsync`, fazer uma checagem leve no array `employees` já carregado:

- Se existir outro ativo com o **mesmo nome (case-insensitive) e mesmo cargo** sem CPF na unidade alvo, mostrar um `confirm`/toast de aviso pedindo para o usuário diferenciar (adicionar sobrenome ou cargo) antes de tentar salvar.
- Isso evita o round-trip ao banco para o caso óbvio e melhora a UX.

Manter o fallback do `onError` traduzido caso o usuário insista ou exista uma corrida.

### 4. Mesmo tratamento no `FreelancerAddModal.tsx` e `EditEmployeeQuickModal.tsx`

Ambos modais hoje exibem o `err.message` cru via toast (ou silenciosamente nos hooks). Vou:

- Garantir que ambos usem os hooks atualizados (`useAddEmployee`/`useUpdateEmployee`) para herdar automaticamente as mensagens amigáveis.
- No `FreelancerAddModal`, a criação direta via `supabase.from("employees").insert(...)` (linha do `handleSubmit`) precisa do mesmo tratamento — encapsular em try/catch e usar o helper compartilhado.

### 5. Memória do projeto

Atualizar `mem://technical/escalas/database-uniqueness-constraints` para refletir que a chave de duplicação sem CPF agora considera **nome + cargo**, e não apenas o nome.

## Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<novo>.sql` | Recriar `unique_active_employee_no_cpf` incluindo `job_title` |
| `src/hooks/useEmployees.ts` | Helper `friendlyEmployeeError` + uso nos 3 mutations |
| `src/components/escalas/TeamManagement.tsx` | Pré-check de duplicata por nome+cargo antes de salvar |
| `src/components/escalas/FreelancerAddModal.tsx` | Tratamento amigável no insert direto |
| `src/components/escalas/EditEmployeeQuickModal.tsx` | Herda do hook atualizado (sem mudanças adicionais) |
| `mem://technical/escalas/database-uniqueness-constraints` | Atualizar regra |

## Resultado esperado

- A usuária consegue cadastrar **ANA (SUBCHEFE)** mesmo já existindo **ANA (CUMIM)** na mesma unidade.
- Se ela tentar cadastrar outra **ANA (SUBCHEFE)** sem CPF, recebe a mensagem clara: "Já existe um funcionário com este nome e cargo nesta unidade. Adicione um sobrenome ou informe o CPF para diferenciar."
- Os outros pontos de criação de funcionário (modal de freelancer e edição rápida) seguem o mesmo padrão.
