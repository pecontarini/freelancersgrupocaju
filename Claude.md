[CLAUDE.md](https://github.com/user-attachments/files/27246373/CLAUDE.md)
# CLAUDE.md — Portal da Liderança (Grupo CajuPAR)

> Arquivo de referência para sessões Claude Code. Leia **inteiro** antes de qualquer tarefa.  
> Última atualização: Abril 2026

---

## 1. VISÃO GERAL DO PROJETO

**Portal da Liderança** é o SaaS operacional do **Grupo CajuPAR** (holding das marcas Caminito Parrilla Asa Sul, Nazo e Caju Limão). O objetivo é digitalizar a gestão de restaurantes — substituindo planilhas físicas e folhas A3 laminadas — e escalar o sistema para todas as unidades do grupo.

| Item | Valor |
|---|---|
| Produto | Portal da Liderança |
| Cliente | Grupo CajuPAR |
| Arquitetura | Multi-tenant (uma instância, múltiplas unidades) |
| Frontend | React + TypeScript (gerado no Lovable, repo GitHub privado) |
| Backend | Supabase (PostgreSQL + Row Level Security) |
| Agentes | OpenClaw v2026.4.22 · Sonnet 4.6 · WhatsApp + Telegram |

---

## 2. STACK E ESTRUTURA DO PROJETO

```
portal-lideranca/
├── src/
│   ├── components/          # Componentes React reutilizáveis
│   │   ├── cmv/             # Módulo CMV
│   │   ├── escalas/         # Módulo Escalas
│   │   └── ui/              # Design system (shadcn/ui base)
│   ├── hooks/               # Custom hooks (useAuth, useCMV, useEscalas…)
│   ├── lib/
│   │   └── supabase.ts      # Cliente Supabase + tipos gerados
│   ├── pages/               # Páginas/rotas principais
│   ├── types/               # Tipos TypeScript globais
│   └── utils/               # Helpers de formatação, datas, cálculos
├── supabase/
│   ├── migrations/          # Migrações SQL versionadas
│   └── functions/           # Edge Functions (quando necessário)
├── CLAUDE.md                # Este arquivo
└── .env.local               # Variáveis de ambiente (NÃO commitar)
```

### Dependências principais

```json
{
  "react": "^18",
  "typescript": "^5",
  "@supabase/supabase-js": "^2",
  "react-router-dom": "^6",
  "tailwindcss": "^3",
  "shadcn/ui": "componentes base",
  "date-fns": "manipulação de datas",
  "react-hook-form": "formulários",
  "zod": "validação de schema"
}
```

---

## 3. AUTENTICAÇÃO E MULTI-TENANCY

### Modelo de tenancy

Cada **unidade** (loja) é um tenant. O isolamento de dados é garantido por **Row Level Security (RLS)** no Supabase — nunca no frontend.

```
organizations          ← Grupo CajuPAR (nível holding)
  └── units            ← Cada restaurante/loja (tenant)
        └── profiles   ← Usuários vinculados à(s) unidade(s)
```

Um usuário pode ter acesso a múltiplas unidades (ex: COO vê todas). O `unit_id` ativo é armazenado em contexto de sessão.

### Roles (perfis de acesso)

| Role | Código | Acesso |
|---|---|---|
| Operador de setor | `operator` | Leitura/escrita no próprio setor e turno |
| Chefe de Back | `back_chief` | CMV completo da unidade |
| Gerente / Proprietário | `admin` | Tudo na unidade |
| COO | `coo` | Todas as unidades (read-only cross-unit) |
| Diretor Regional | `regional_director` | Unidades da sua região |
| Superadmin (Holding) | `superadmin` | Acesso total irrestrito |

### Padrão de RLS

Toda tabela sensível deve ter política RLS baseada em `unit_id`:

```sql
-- Política padrão de leitura por unidade
CREATE POLICY "unit_isolation_select"
ON tabela
FOR SELECT
USING (
  unit_id = (
    SELECT unit_id FROM profiles
    WHERE id = auth.uid()
  )
);
```

---

## 4. SCHEMA SUPABASE — MÓDULO CMV

### Regras de negócio críticas (NÃO alterar sem validação operacional)

1. **Câmara Congelada** — controle semanal de estoque congelado  
   `SALDO = SALDO_ANTERIOR + ENTRADA - SAÍDA`

2. **Praça / Operação** — controle por turno (shift-based)  
   `VAR_DIA = T1 - T3` (T1 = abertura do dia, T3 = fechamento do dia)

3. **Campos calculados** → SEMPRE usar `GENERATED ALWAYS AS` no PostgreSQL. **Nunca calcular no frontend**.

4. **Campos vazios** → salvar como `NULL`, nunca `0`. Zero é um valor operacional válido.

5. **18 produtos** de proteínas monitorados, com unidades `UN` (unidades inteiras) ou `KG` (quilogramas).

### Tabelas principais do CMV

```sql
-- Produtos monitorados (seed data, não muda frequentemente)
CREATE TABLE cmv_products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      UUID REFERENCES units(id) NOT NULL,
  name         TEXT NOT NULL,                    -- ex: "Picanha", "Fraldinha"
  unit_type    TEXT CHECK (unit_type IN ('UN', 'KG')) NOT NULL,
  display_order INT NOT NULL,
  active       BOOLEAN DEFAULT true
);

-- Câmara Congelada — balanço semanal
CREATE TABLE cmv_camara_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         UUID REFERENCES units(id) NOT NULL,
  product_id      UUID REFERENCES cmv_products(id) NOT NULL,
  week_start_date DATE NOT NULL,                 -- segunda-feira da semana
  saldo_anterior  NUMERIC(10,3),                 -- NULL se primeira semana
  entrada         NUMERIC(10,3),                 -- NULL se não houve entrada
  saida           NUMERIC(10,3),                 -- NULL se não houve saída
  -- COLUNA GERADA — não inserir/atualizar diretamente
  saldo           NUMERIC(10,3) GENERATED ALWAYS AS (
    COALESCE(saldo_anterior, 0) + COALESCE(entrada, 0) - COALESCE(saida, 0)
  ) STORED,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, product_id, week_start_date)
);

-- Praça / Operação — contagem por turno
CREATE TABLE cmv_praca_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      UUID REFERENCES units(id) NOT NULL,
  product_id   UUID REFERENCES cmv_products(id) NOT NULL,
  shift_date   DATE NOT NULL,
  t1           NUMERIC(10,3),   -- Abertura (início do dia) — NULL se não contado
  t2           NUMERIC(10,3),   -- Meio de turno — NULL se não contado
  t3           NUMERIC(10,3),   -- Fechamento (fim do dia) — NULL se não contado
  -- COLUNA GERADA
  var_dia      NUMERIC(10,3) GENERATED ALWAYS AS (
    CASE
      WHEN t1 IS NOT NULL AND t3 IS NOT NULL THEN t1 - t3
      ELSE NULL
    END
  ) STORED,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, product_id, shift_date)
);
```

---

## 5. SCHEMA SUPABASE — MÓDULO ESCALAS

### Regras de negócio críticas (hard blocks — NUNCA permitir salvar em violação)

| Regra | Limite | Tipo |
|---|---|---|
| Jornada diária máxima | > 10h → bloqueio | Hard block |
| Jornada semanal máxima | > 44h → alerta; > 48h → bloqueio | Hard block |
| Intervalo mínimo entre turnos | < 11h → bloqueio | Hard block |
| Prioridade para freelancers | Freelancer antes de hora extra | Hard block |
| Remapeamento de setor | Conforme POP 02 | Hard block |

### Código de cores (frontend)

```typescript
// Horas semanais
const getWeeklyHoursColor = (hours: number) => {
  if (hours < 44)  return 'green';   // Normal
  if (hours <= 48) return 'yellow';  // Atenção
  return 'red';                       // Bloqueio
};

// Célula de dia
const getDailyHoursColor = (hours: number) => {
  if (hours > 10) return 'red-cell'; // Sempre red, qualquer role
  return 'normal';
};
```

### Tabelas principais de Escalas

```sql
CREATE TABLE employees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     UUID REFERENCES units(id) NOT NULL,
  name        TEXT NOT NULL,
  sector      TEXT NOT NULL,   -- 'cozinha' | 'parrilla' | 'salao' | 'bar' | 'sushi' | 'recepcao' | 'delivery' | 'asg'
  role        TEXT NOT NULL,   -- cargo específico
  is_freelancer BOOLEAN DEFAULT false,
  active      BOOLEAN DEFAULT true
);

CREATE TABLE schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      UUID REFERENCES units(id) NOT NULL,
  employee_id  UUID REFERENCES employees(id) NOT NULL,
  week_start   DATE NOT NULL,  -- sempre segunda-feira
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE schedule_shifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID REFERENCES schedules(id) NOT NULL,
  shift_date   DATE NOT NULL,
  start_time   TIME,            -- NULL = folga
  end_time     TIME,            -- NULL = folga
  is_day_off   BOOLEAN DEFAULT false,
  is_half_day  BOOLEAN DEFAULT false,   -- meia folga
  -- COLUNA GERADA
  hours_worked NUMERIC(4,2) GENERATED ALWAYS AS (
    CASE
      WHEN is_day_off = true OR start_time IS NULL OR end_time IS NULL THEN 0
      ELSE EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
    END
  ) STORED,
  notes        TEXT
);
```

---

## 6. TABELAS DE INFRAESTRUTURA MULTI-TENANT

```sql
CREATE TABLE organizations (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL,   -- "Grupo CajuPAR"
  slug  TEXT UNIQUE NOT NULL
);

CREATE TABLE units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name            TEXT NOT NULL,   -- "Caminito Asa Sul", "Nazo Asa Norte"...
  slug            TEXT NOT NULL,
  region          TEXT,
  active          BOOLEAN DEFAULT true,
  UNIQUE(organization_id, slug)
);

CREATE TABLE profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id),
  unit_id   UUID REFERENCES units(id),   -- unidade principal
  full_name TEXT NOT NULL,
  role      TEXT NOT NULL CHECK (role IN (
    'operator', 'back_chief', 'admin', 'coo', 'regional_director', 'superadmin'
  )),
  sector    TEXT,   -- setor específico para 'operator'
  active    BOOLEAN DEFAULT true
);

-- Para usuários com acesso multi-unidade (COO, Regional Director)
CREATE TABLE profile_unit_access (
  profile_id UUID REFERENCES profiles(id),
  unit_id    UUID REFERENCES units(id),
  PRIMARY KEY (profile_id, unit_id)
);
```

---

## 7. PADRÕES DE CÓDIGO

### TypeScript — regras obrigatórias

```typescript
// ✅ SEMPRE tipar retornos de Supabase explicitamente
const { data, error } = await supabase
  .from('cmv_praca_entries')
  .select('*')
  .eq('unit_id', unitId)
  .returns<CMVPracaEntry[]>();

// ✅ NUNCA calcular colunas geradas no frontend
// As colunas var_dia e saldo vêm do banco — não recalcular

// ✅ Tratar NULL explicitamente (não assumir zero)
const displayValue = (val: number | null) =>
  val !== null ? val.toFixed(2) : '—';

// ✅ Usar Zod para validar formulários antes de enviar ao Supabase
const CMVEntrySchema = z.object({
  t1: z.number().nonnegative().nullable(),
  t2: z.number().nonnegative().nullable(),
  t3: z.number().nonnegative().nullable(),
});
```

### Supabase — regras obrigatórias

```sql
-- ✅ SEMPRE versionar migrations com timestamp
-- supabase/migrations/20260430_add_cmv_praca.sql

-- ✅ NUNCA alterar colunas GENERATED ALWAYS AS via UPDATE
-- Elas são computadas automaticamente

-- ✅ SEMPRE testar RLS policies com service_role OFF
-- antes de fazer deploy

-- ✅ Usar índices em colunas de filtro frequente
CREATE INDEX idx_cmv_praca_unit_date ON cmv_praca_entries(unit_id, shift_date);
CREATE INDEX idx_schedules_unit_week ON schedules(unit_id, week_start);
```

### Convenções de nomenclatura

| Tipo | Padrão | Exemplo |
|---|---|---|
| Tabelas Supabase | `snake_case` | `cmv_praca_entries` |
| Tipos TypeScript | `PascalCase` | `CMVPracaEntry` |
| Componentes React | `PascalCase` | `CMVPracaBoard` |
| Hooks | `camelCase` com `use` | `useCMVPraca` |
| Funções utilitárias | `camelCase` | `formatCMVValue` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_WEEKLY_HOURS` |

---

## 8. MÓDULOS — STATUS E PROPRIETÁRIO

| Módulo | Status | Dev principal | Notas |
|---|---|---|---|
| Auth / Multi-tenant | 🟡 Em progresso | Claude Code | RLS precisa auditoria |
| CMV — Câmara Congelada | 🟢 Schema definido | Claude Code | Lógica de saldo encadeado |
| CMV — Praça/Operação | 🟢 Schema definido | Claude Code | T1/T2/T3 por turno |
| Escalas — Calculadora de horas | 🟡 Em progresso | Lovable | UI já existe |
| Escalas — Dashboard POP | 🟡 Scoped | Lovable | Aguarda dados reais |
| Agente CMV (OpenClaw) | 🔴 Planejado | OpenClaw | Pós SKILL.md |
| Agente Escalas (OpenClaw) | 🔴 Planejado | OpenClaw | Pós SKILL.md |

---

## 9. REGRAS PARA SESSÕES CLAUDE CODE

### O que Claude Code DEVE fazer

- ✅ Ler este arquivo antes de qualquer tarefa
- ✅ Criar migrations SQL versionadas em `supabase/migrations/`
- ✅ Usar `GENERATED ALWAYS AS` para todas as colunas calculadas
- ✅ Salvar `NULL` (nunca `0`) em campos não preenchidos
- ✅ Testar RLS com `service_role` desativado antes de concluir
- ✅ Perguntar antes de alterar qualquer lógica de negócio do CMV
- ✅ Gerar tipos TypeScript após migrações (`supabase gen types`)
- ✅ Commitar em branches feature/ antes de merge em main

### O que Claude Code NUNCA deve fazer

- ❌ Calcular `saldo`, `var_dia` ou `hours_worked` no frontend
- ❌ Substituir `NULL` por `0` em campos de contagem
- ❌ Alterar a lógica de isolamento de `unit_id` sem aprovação explícita
- ❌ Fazer `DROP TABLE` ou `DROP COLUMN` sem migration de rollback pronta
- ❌ Pushes diretos em `main` (sempre via branch + PR)
- ❌ Tocar em componentes Lovable sem aprovação (risco de conflito de sync)

---

## 10. FLUXO DE TRABALHO LOVABLE ↔ CLAUDE CODE

```
Lovable                          Claude Code
   │                                  │
   │  UI / Componentes React          │  Schema, Migrations, RLS
   │  Design system                   │  Edge Functions
   │  Páginas e rotas                 │  Tipos TypeScript gerados
   │  Formulários (react-hook-form)   │  Lógica de negócio complexa
   │  Estilo (Tailwind)               │  Auditoria de codebase
   │                                  │
   └──────── GitHub (main) ───────────┘
                   │
            Supabase Backend
```

**Regra de ouro:** Se a tarefa envolve banco de dados, tipos ou lógica → **Claude Code**. Se envolve tela, componente ou estilo → **Lovable**.

---

## 11. VARIÁVEIS DE AMBIENTE

```bash
# .env.local (nunca commitar)
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]

# Apenas para scripts locais/migrations (nunca expor no frontend)
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
SUPABASE_DB_PASSWORD=[db-password]
```

---

## 12. CONTEXTO OPERACIONAL (para decisões de produto)

### Hierarquia operacional

```
Holding / Matriz (Grupo CajuPAR)
  └── Diretor Regional de Operações
        └── COO
              └── Gerente de Back (responsável pelo CMV da unidade)
              └── Gerente de Front (responsável pelas Escalas do front)
                    └── Chefe de Parrilla (controle de carnes)
                    └── Chefe de Cozinha
                    └── Chefe de Sushi
                    └── Chefe de Bar
                    └── Chefe de Salão
```

### Metas e CMV (contexto de negócio)

- **Gerente de Back** tem até R$ 2.000 de variável atrelados ao CMV — é o "defensor do CMV" na loja
- **Chefe de Parrilla** tem meta de controle de unitários de carnes
- O controle de CMV substitui o quadro A3 laminado que os chefes usavam fisicamente
- Variável do dia (`VAR_DIA = T1 - T3`) indica quanto foi consumido no turno

### POP de Escalas

- Folgas e meias-folgas preferencialmente em dias de **menor venda histórica**
- Gerente **não pode** se ausentar sem deixar Chefe de Apoio escalado
- Freelancer tem prioridade sobre hora extra de funcionário CLT
- Máximo de 10h/dia por colaborador é hard block operacional

---

## 13. COMANDOS ÚTEIS

```bash
# Rodar localmente
npm install
npm run dev

# Gerar tipos TypeScript do Supabase (rodar após qualquer migration)
npx supabase gen types typescript --project-id [project-ref] > src/types/supabase.ts

# Aplicar migrations localmente
npx supabase db push

# Exportar codebase para análise (gitingest)
# Acessar gitingest.com → ativar "Private Repository" → colar URL do repo

# Testar RLS manualmente via Supabase Studio
# Settings → API → desativar service_role → testar queries
```

---

## 14. PRÓXIMAS TAREFAS PRIORIZADAS

### Sprint atual — Claude Code

1. [ ] Auditoria de RLS: verificar se todas as tabelas têm `unit_id` isolado
2. [ ] Migration: ajustar `hours_worked` em `schedule_shifts` para cobrir virada de meia-noite
3. [ ] Gerar tipos TypeScript atualizados e subir no repo
4. [ ] Criar `SKILL.md` do Portal CajuPAR para integração OpenClaw

### Backlog — Lovable

1. [ ] Calculadora de horas semanais (Escalas) — UI com color coding
2. [ ] Dashboard POP compliance — summary cards + heatmap semanal
3. [ ] Tela de resumo CMV por semana com exportação

---

*Este arquivo deve ser atualizado a cada sprint. Pedro é o único aprovador de mudanças nas regras de negócio do CMV e nas definições de RLS.*
