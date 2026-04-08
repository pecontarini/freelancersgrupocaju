

# Plano: Unificar freelancers via CPF — Budget + Escalas + Check-in

## Problema atual

Existem 3 sistemas desconectados de freelancers:
1. **Budget** (`freelancer_entries`) — tem CPF, nome, função, chave PIX
2. **Escalas** (`employees` com `worker_type=freelancer`) — tem nome, cargo, mas **não tem CPF**
3. **Check-in** (`freelancer_profiles`) — tem CPF, nome, telefone, chave PIX

Não há vínculo entre eles. O mesmo freelancer pode existir em 3 tabelas sem conexão.

## Solução: Adicionar CPF à tabela `employees` e usar como chave de vínculo

### 1. Migração: adicionar coluna `cpf` à tabela `employees`

```sql
ALTER TABLE public.employees ADD COLUMN cpf text;
CREATE INDEX idx_employees_cpf ON public.employees(cpf);
```

Coluna nullable para não quebrar CLTs e registros existentes.

### 2. `FreelancerAddModal.tsx` — Campo CPF com auto-preenchimento

No modo "Criar Novo":
- Adicionar campo CPF com formatação automática
- Ao digitar CPF completo (11 dígitos), buscar em `freelancer_profiles` E em `freelancer_entries` (usando a mesma lógica do `useCpfLookup`)
- Se encontrar, preencher automaticamente: nome, chave PIX
- Salvar o CPF no registro `employees` ao criar

No modo "Existente":
- Exibir o CPF ao lado do nome (se disponível) para facilitar identificação

### 3. `FreelancerForm.tsx` (Budget) — Buscar também em `employees`

Expandir o `handleCpfLookup` para buscar também na tabela `employees` (freelancers da escala) além de `freelancer_entries` e `freelancer_profiles`. Isso garante que dados cadastrados na escala alimentem o budget.

### 4. `useCpfLookup.ts` — Adicionar busca unificada

Criar função `lookupUnifiedByCpf` que busca em ordem de prioridade:
1. `freelancer_profiles` (dados mais completos — tem foto, telefone, PIX)
2. `employees` onde `worker_type = 'freelancer'` e `cpf` bate
3. `freelancer_entries` (fallback histórico)

Retorna os dados mais recentes/completos encontrados.

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar coluna `cpf` em `employees` |
| `src/hooks/useCpfLookup.ts` | Busca unificada em 3 tabelas |
| `src/components/escalas/FreelancerAddModal.tsx` | Campo CPF + auto-fill ao criar freelancer |
| `src/components/FreelancerForm.tsx` | Usar busca unificada |

## Resultado

- Digitar CPF em qualquer formulário puxa dados de todas as fontes
- Freelancers criados na escala ficam vinculados por CPF ao budget e check-in
- Sistema integrado: mesmo freelancer é reconhecido em todas as abas

