## Objetivo

Permitir que o COO aprove uma escala IA via **link público** (sem precisar logar no portal), e — ao aprovar — gerar automaticamente a visualização equivalente ao **Editor de Escalas** com slots vazios prontos para vinculação de pessoas.

---

## Fluxo do usuário

1. Líder gera escala IA → status `pendente_aprovacao`.
2. Líder clica **"Enviar link para o COO"** → portal copia/exibe URL pública e (opcional) abre WhatsApp pré-preenchido.
3. COO abre o link no celular → vê o painel de revisão (mesmo layout do `EscalaApprovalPanel`, read-only ou com edição de horários) → **Aprovar** ou **Solicitar revisão** com comentário.
4. Ao aprovar: backend grava `status='aprovado'` + `aprovado_por='COO via link'` + `aprovado_em` e **materializa os slots como linhas em `schedules`** (1 linha por slot × quantidade × dia da semana, com `funcionario_id = null` e `funcionario_nome = ''`).
5. Líder vê automaticamente os horários aprovados aparecerem no **Editor de Escalas** oficial (aba "Editor de Escalas") como blocos vazios → arrasta/atribui pessoas usando o editor que já existe hoje.

---

## Arquitetura técnica

### 1. Tabela `escala_aprovacao_links` (nova)

```text
id              uuid PK
template_id     uuid FK escala_template
token           text UNIQUE (32+ chars, gerado server-side)
criado_por      uuid (auth.uid)
criado_em       timestamptz default now()
expira_em       timestamptz (default now() + 7 days)
usado_em        timestamptz nullable
ip_aprovador    text nullable
```

RLS: SELECT/INSERT só para usuários autenticados da unidade do template. Acesso público vai pela edge function (service role).

### 2. Edge Functions (públicas, sem JWT)

- **`escala-aprovacao-info`** — `GET ?token=...`
  - Valida token, expira_em, status do template.
  - Retorna `{ template_id, setor, semana_inicio, payload, status, unidade_nome }`.

- **`escala-aprovacao-decidir`** — `POST { token, decisao: 'aprovar'|'rejeitar', comentario?, payload_editado? }`
  - Valida token + status `pendente_aprovacao`.
  - Se `aprovar`:
    - Atualiza `escala_template`: status, aprovado_por='COO (link público)', aprovado_em, payload (se editado).
    - **Materializa slots em `schedules`**: para cada dia da semana × cada slot × cada `quantidade`, insere uma linha em `schedules` com `funcionario_id=null`, `start_time`/`end_time` derivados de t1/t2, `unit_id`, `setor`, `data` calculada a partir de `semana_inicio + offset_dia`.
  - Se `rejeitar`: status='rejeitado', `comentario_rejeicao`.
  - Marca `usado_em` no link.

### 3. Página pública `/aprovar-escala/:token`

- Sem autenticação (rota fora do `ProtectedRoute`).
- Layout = mesmo visual de `EscalaApprovalPanel` (cards, accordion por dia, tabela de horários, checks de validação) já que a estrutura existe — extrair em componente compartilhado `EscalaApprovalView` reutilizado pelo painel interno e pela página pública.
- Botões "Aprovar" e "Solicitar revisão" chamam `escala-aprovacao-decidir`.
- Feedback de sucesso + selo "Aprovada às HH:MM por COO via link".

### 4. UI no portal (líder)

No `EscalasItaimSection`, no card de status "pendente_aprovacao", adicionar:

- Botão **"Gerar link de aprovação"** → cria registro em `escala_aprovacao_links`, copia URL para clipboard, mostra toast.
- Botão **"Enviar via WhatsApp"** → abre `https://wa.me/?text=...` com texto:
  > "Olá! Por favor revisar e aprovar a escala do BAR — Caju Itaim — semana 11/05 a 17/05: [URL]"

### 5. Materialização para o Editor de Escalas

Função utilitária server-side `materializar_template_em_schedules(template_id)`:

- Lê payload, itera por `dias[SEG..DOM]` × `slots`.
- Calcula `data` = `semana_inicio + DIAS_OFFSET[dia_semana]`.
- Para cada slot, cria N rows (N = `quantidade`) em `schedules` com:
  - `unit_id`, `sector` (do template), `date`, `start_time` = `t1.entrada` (ou `t2.entrada` se sem t1), `end_time` = última `saida`, `break_minutes` = `break_min`, `funcionario_id=null`, `is_template=true` (flag opcional).
- O Editor de Escalas existente já lista todos os `schedules` da semana — slots vazios aparecerão prontos para drag-and-drop dos funcionários (fluxo que já funciona hoje).

---

## Pontos a confirmar antes da implementação

1. **Identificação do COO no link**: o link é único e qualquer pessoa com a URL pode aprovar (token = autorização)? Ou precisa pedir nome/PIN do COO antes de confirmar?
2. **Edição de horários no link público**: o COO pode editar os horários antes de aprovar (como hoje no painel interno) ou só aprova/rejeita?
3. **Materialização em `schedules`**: confirmar que essa é a tabela correta usada pelo Editor de Escalas (vi `useSchedules`/`useManualSchedules` hooks no projeto). Devo criar as linhas com algum marcador (`source='ia_template'`) para distinguir das criadas manualmente?
4. **Expiração do link**: 7 dias OK? Permitir regenerar?

---

## Entregáveis

- Migração: tabela `escala_aprovacao_links` + RLS.
- Edge functions: `escala-aprovacao-info`, `escala-aprovacao-decidir`.
- Componente: `EscalaApprovalView` (extraído do painel atual, reutilizável).
- Página: `src/pages/AprovarEscala.tsx` + rota pública.
- Botões de "Gerar link" + "Enviar WhatsApp" em `EscalasItaimSection`.
- Função de materialização (dentro da edge `escala-aprovacao-decidir`).