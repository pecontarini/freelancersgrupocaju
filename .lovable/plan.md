

## Plano: motor único de CPF como base do lançamento de freelancer

### Causa raiz (confirmada no banco)

CPF está armazenado em **3 formatos diferentes** entre as tabelas:

| Tabela | Formato | Exemplo |
|---|---|---|
| `freelancer_profiles` | misto (11 ou 14) | `00017675260` ou `714.197.601-90` |
| `freelancer_entries` | sempre 14 (formatado) | `189.845.716-60` |
| `employees` (freelancer) | sempre 11 (limpo) | `01116400162` |

O hook `useCpfLookup` faz `.eq("cpf", X)` com **um único formato por tabela**. Resultado: para qualquer CPF salvo no formato "errado" da tabela consultada, a busca retorna `null` e **nada é auto-preenchido** — exatamente o problema relatado tanto no Budget Gerencial (`FreelancerForm.tsx`) quanto nas Escalas (`FreelancerAddModal.tsx`).

Já confirmei o caso: um mesmo CPF `00017675260` existe em `freelancer_profiles` como `00017675260` e em `freelancer_entries` como `000.176.752-60`. Quem digita esse CPF hoje no formulário recebe a busca em `profiles` por 11 chars (ok) e em `entries` por 14 chars (ok individualmente), mas se só tiver registro em uma das tabelas no formato divergente, **falha**.

### Solução: motor único de CPF + normalização persistente

#### 1) RPC `lookup_freelancer_unified(p_cpf text)` — fonte única de verdade

Criar uma função SECURITY DEFINER no banco que centraliza **toda** a busca em um único lugar, normalizando o CPF com `regexp_replace(cpf, '\D', '', 'g')` em **toda** comparação. Retorna o melhor registro consolidando dados das 3 tabelas:

```text
prioridade de campos:
  nome_completo:  profiles → employees → entries
  telefone:       profiles → employees
  chave_pix:      profiles → entries (mais recente)
  tipo_chave_pix: profiles
  funcao:         employees.job_title → entries.funcao (mais recente)
  gerencia:       entries.gerencia (mais recente)
  foto_url:       profiles
  found_in:       array das tabelas onde encontrou
```

Vantagens:
- ignora completamente o formato do CPF na DB;
- bypassa RLS (cobre lookup cross-loja, inclui CPFs de outras unidades);
- 1 round-trip só, sem encadeamento de queries no front;
- mesmo motor para Budget e Escalas → comportamento idêntico.

#### 2) Reescrever `useCpfLookup.ts` para chamar só esse RPC

- Remove `lookupFreelancerByCpf` (legacy) e o `lookupUnifiedByCpf` antigo (que faz 4 queries em cascata).
- Mantém a mesma assinatura pública `lookupUnifiedByCpf(cpf) → UnifiedLookupResult` para não quebrar os consumidores.
- Loga toast de sucesso já dizendo de onde veio (ex: "dados do cadastro central", "dados do histórico").
- Mantém `lookupSupplierByCpfCnpj` separado (manutenção).

#### 3) Persistência sempre no formato canônico (CPF limpo, 11 dígitos)

Mudança de padrão para todas as **novas** inserções:

- `FreelancerForm.tsx → onSubmit`: limpa o CPF antes do `createEntry` (envia 11 chars).
- `useFreelancerEntries.createEntry`: normaliza CPF antes do insert e antes do upsert em `freelancer_profiles`.
- `FreelancerAddModal.tsx`: já envia limpo para `employees` e `freelancer_profiles` — ok.
- Trigger `sync_schedule_to_freelancer_entry`: já usa `regexp_replace(cpf, '\D', '', 'g')` para `freelancer_profiles`, mas insere `v_emp.cpf` cru em `freelancer_entries.cpf` — vou normalizar ali também.

Com isso, daqui pra frente **toda nova linha** entra com CPF limpo nas 3 tabelas. O lookup por RPC já cobre o legado em qualquer formato.

#### 4) Migração one-shot do legado

Migration que normaliza CPF nas tabelas existentes, com cuidado para não violar unicidade:

- `freelancer_profiles`: `cpf` tem unique constraint. Para cada CPF formatado, se já existir a versão limpa, mesclar (manter o registro mais completo: foto_url + telefone + pix); senão, só normalizar.
- `freelancer_entries`: sem unique, basta `UPDATE`.
- `employees`: já está 100% limpo, nada a fazer.

#### 5) Auto-disparo do lookup também em paste/colado e quando vier com 11 dígitos sem formatação

`FreelancerForm.tsx` hoje só dispara o lookup quando `formatted.length === 14`. Se o usuário colar um CPF puro de 11 dígitos, a função `formatCPF` formata para 14 e dispara — ok. Mas se digitar parcialmente e clicar fora, não dispara. Ajustar:

- Disparar onChange quando `cleanCpf.length === 11`.
- Disparar onBlur como fallback adicional.
- Mesmo padrão no `FreelancerAddModal.tsx` (já dispara em 11 dígitos — manter).

#### 6) Mensagem visual consistente

Quando o lookup encontrar dados:
- toast verde com origem;
- campos preenchidos ganham borda verde + texto "Preenchido automaticamente";
- usuário pode editar livremente (já implementado).

### Arquivos afetados

- **Migration nova**: criar RPC `lookup_freelancer_unified` + normalizar CPFs legados em `freelancer_profiles` e `freelancer_entries`.
- **Migration nova (trigger)**: ajustar `sync_schedule_to_freelancer_entry` para normalizar `cpf` antes do insert em `freelancer_entries`.
- **`src/hooks/useCpfLookup.ts`**: reescrever `lookupUnifiedByCpf` para chamar só o novo RPC. Remover lookups encadeados.
- **`src/hooks/useFreelancerEntries.ts`**: normalizar CPF (11 dígitos) antes de `insert` e `upsert(freelancer_profiles)`.
- **`src/components/FreelancerForm.tsx`**: disparar lookup também em onBlur; normalizar CPF antes de submit.
- **`src/components/escalas/FreelancerAddModal.tsx`**: nenhuma mudança funcional — já usa `lookupUnifiedByCpf` (vai herdar o motor novo automaticamente).

### O que **não** muda
- UI dos formulários permanece idêntica.
- Validação de CPF (`isValidCPF`) permanece.
- Fluxo "sem CPF" no modal de escala segue funcionando.
- Trigger de pagamento e RLS intactos.

### Validação

1. **CPF formato 14 chars salvo só em entries**: digitar no Budget → deve auto-preencher nome, função, gerência, PIX.
2. **CPF limpo 11 chars salvo só em profiles**: digitar no Budget → deve auto-preencher nome + PIX + telefone.
3. **CPF que existe em employees de outra unidade**: digitar no modal de escala → deve trazer o nome (cross-loja).
4. **CPF novo (não cadastrado)**: digitar → sem toast, campos vazios para preenchimento manual.
5. **CPF salvo em formatos diferentes em tabelas diferentes**: digitar em qualquer formato → mesmo resultado, sem perder dado.
6. **Após salvar um novo lançamento via Budget**: conferir no banco que CPF entrou com 11 dígitos limpos em todas as tabelas.

