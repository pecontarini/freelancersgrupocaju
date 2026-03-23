

# Plano Revisado: Sistema de Check-in/Check-out de Freelancers via QR Code

## Visão Geral

Sistema completo de controle de presença via QR Code, com fluxo público mobile-first, validação pelo gestor (foto + valor) e geração de ordem de pagamento condicionada à dupla aprovação.

## 1. Banco de Dados

### Tabela `freelancer_profiles`

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| cpf | text UNIQUE NOT NULL | Identificador principal |
| nome_completo | text NOT NULL | |
| telefone | text | |
| foto_url | text | Foto de cadastro (Storage) |
| created_at | timestamptz | default now() |

### Tabela `freelancer_checkins`

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| freelancer_id | uuid FK → freelancer_profiles | |
| loja_id | uuid FK → config_lojas | |
| checkin_at | timestamptz NOT NULL | |
| checkin_selfie_url | text NOT NULL | **Obrigatório** — selfie no check-in |
| checkin_lat / checkin_lng | numeric | Geolocalização |
| checkout_at | timestamptz | null = em aberto |
| checkout_selfie_url | text | **Obrigatório no check-out** |
| checkout_lat / checkout_lng | numeric | |
| valor_informado | numeric | Valor preenchido pelo freelancer |
| valor_aprovado | numeric | Valor confirmado pelo gestor/admin |
| valor_status | text | 'pending', 'approved', 'adjusted' |
| status | text | 'open', 'completed', 'approved', 'rejected' |
| approved_by | uuid | gestor que aprovou presença |
| approved_at | timestamptz | |
| valor_approved_by | uuid | quem confirmou o valor |
| valor_approved_at | timestamptz | |
| rejection_reason | text | |
| created_at | timestamptz | |

Constraint UNIQUE: `(freelancer_id, loja_id, DATE(checkin_at))`

### Tabela `checkin_approvals`
Assinatura em lote do gestor.

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid PK | |
| loja_id | uuid FK | |
| approval_date | date NOT NULL | |
| approved_by | uuid FK | |
| approved_at | timestamptz | |
| pin_hash | text | |
| checkin_ids | uuid[] | |

### Storage
- Bucket `freelancer-checkin-photos` (público) — selfies e fotos de perfil

### Edge Function
- `checkin-upload-photo` — recebe base64, faz upload via service_role, retorna URL pública

### RLS
- `freelancer_profiles`: SELECT/INSERT público (lookup e cadastro via QR)
- `freelancer_checkins`: INSERT público (check-in/out), SELECT/UPDATE para gestores autenticados
- `checkin_approvals`: INSERT/SELECT para autenticados com acesso à loja

## 2. Fluxo do Freelancer (página pública `/checkin?unidade=UUID`)

```text
Escaneia QR → Digita CPF
       │
   ┌───┴───┐
   │ Novo? │
   └───┬───┘
  Sim  │  Não
   │   │   │
   ▼   │   ▼
Cadastro│ Confirma dados
(nome,  │
 foto   │
 obrig.)│
   └───┬───┘
       │
 Tem check-in aberto hoje?
   ┌───┴───┐
  Sim     Não
   │       │
   ▼       ▼
Check-out  Check-in
- selfie   - selfie OBRIGATÓRIA
  OBRIG.   - geolocalização
- geo      - valor (R$) informado
- horário    pelo freelancer
       │
       ▼
 Registro salvo (valor_status = 'pending')
```

**Regras de foto:**
- Check-in: selfie obrigatória antes de registrar. Sem foto = sem check-in.
- Check-out: selfie obrigatória antes de registrar saída.
- Cadastro novo: foto de perfil obrigatória.

**Valor informado:**
- O freelancer preenche o valor (R$) que espera receber no momento do check-in.
- O valor fica com status `pending` até confirmação do gestor.

## 3. Painel do Gestor (dupla validação)

### Validação de Presença (já prevista)
- Foto cadastro vs selfie check-in lado a lado
- Selfie do check-out
- Horários, geolocalização
- Aprovar ou rejeitar presença

### Validação de Valor (nova)
- Exibe o valor informado pelo freelancer
- Gestor/Admin pode: **confirmar** o valor ou **ajustar** (informando novo valor)
- Somente após ambas validações (presença + valor) o registro fica apto para pagamento
- Campo `valor_aprovado` recebe o valor final

```text
Gestor abre painel do dia
       │
       ▼
Lista de freelancers com:
- Fotos (cadastro vs selfie) ← COMPARAÇÃO VISUAL
- Horários entrada/saída
- Valor informado pelo freelancer
       │
       ▼
Para cada registro:
1. Aprovar/Rejeitar PRESENÇA
2. Confirmar/Ajustar VALOR
       │
       ▼
Assina lote com PIN
       │
       ▼
Ordem de pagamento liberada
(usa valor_aprovado, não valor_informado)
```

## 4. Ordem de Pagamento
- Só gera para registros com `status = 'approved'` E `valor_status = 'approved'`
- Usa `valor_aprovado` (não o informado)
- Lista freelancers com entrada, saída e valor confirmado

## 5. Componentes

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/FreelancerCheckin.tsx` | Página pública mobile-first |
| `src/components/checkin/CheckinManagerDashboard.tsx` | Painel gestor com dupla validação |
| `src/components/checkin/CheckinApprovalCard.tsx` | Card: fotos lado a lado + valor |
| `src/components/checkin/CheckinBatchApproval.tsx` | Assinatura em lote com PIN |
| `src/components/checkin/CheckinPaymentOrder.tsx` | Ordem de pagamento (aprovados) |
| `src/components/checkin/QRCodeGenerator.tsx` | Gerador QR na aba Configurações |
| `src/hooks/useFreelancerProfiles.ts` | CRUD perfis |
| `src/hooks/useFreelancerCheckins.ts` | Registros de presença |
| `src/hooks/useCheckinApprovals.ts` | Aprovações |
| `supabase/functions/checkin-upload-photo/index.ts` | Upload de fotos |
| `src/App.tsx` | Rota `/checkin` pública |
| `src/components/layout/AppSidebar.tsx` | Tab "Presença" |
| `src/pages/Index.tsx` | Renderizar painel do gestor |

## 6. Ordem de Implementação

1. Migração SQL — tabelas, bucket, RLS, constraints
2. Edge Function — upload de foto
3. Página pública `/checkin` — fluxo completo (CPF → cadastro/lookup → selfie obrigatória → valor → registro)
4. QR Code Generator — aba Configurações
5. Painel do Gestor — validação de presença (fotos) + validação de valor
6. Ordem de Pagamento — condicionada a presença aprovada + valor confirmado
7. Rota no App.tsx

