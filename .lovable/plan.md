

# Plano: Adicionar Chave Pix ao Cadastro de Freelancers via QR Code

## Diagnóstico

A página `/checkin` e todo o fluxo (CPF lookup, cadastro, selfie, check-in/check-out) **já existem e funcionam**. O que falta é adicionar os campos de Pix ao cadastro de novos freelancers.

## Mudanças

### 1. Migração SQL -- adicionar colunas à `freelancer_profiles`

```sql
ALTER TABLE public.freelancer_profiles 
  ADD COLUMN tipo_chave_pix text,
  ADD COLUMN chave_pix text;
```

### 2. `src/hooks/useFreelancerProfiles.ts`

- Adicionar `tipo_chave_pix` e `chave_pix` à interface `FreelancerProfile`
- Aceitar esses campos no `createProfile.mutationFn`

### 3. `src/pages/FreelancerCheckin.tsx`

No step `"register"`, adicionar:
- State para `regTipoChavePix` (select: CPF, E-mail, Telefone, Chave Aleatória)
- State para `regChavePix` (input text)
- Ambos obrigatórios na validação do `handleRegister`
- Passar os valores ao `createProfile.mutateAsync`

Na tela de confirmação (`"confirm"`), exibir a chave Pix cadastrada.

## Arquivos editados

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Adicionar `tipo_chave_pix` e `chave_pix` à tabela |
| `src/hooks/useFreelancerProfiles.ts` | Atualizar interface e mutation |
| `src/pages/FreelancerCheckin.tsx` | Adicionar campos Pix ao formulário de cadastro |

