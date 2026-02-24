

## Plano: Relatorio de Nao Conformidades + Link de Correcao

### Objetivo

Criar um fluxo completo onde chefes/gerentes geram um relatorio das nao conformidades identificadas no checklist diario, e ao final desse relatorio ha um link publico que permite ao time registrar as correcoes com foto comprovando a resolucao.

---

### Visao geral do fluxo

```text
Checklist aplicado (itens NAO)
        |
        v
Dashboard de Respostas --> Botao "Gerar Relatorio NC"
        |
        v
PDF institucional com lista de nao conformidades
+ Link publico ao final do PDF
        |
        v
Time abre o link --> Ve os itens pendentes
--> Marca como corrigido + anexa foto + nome
        |
        v
Status atualizado no banco (visivel no dashboard)
```

---

### Mudancas

**1. Nova tabela: `checklist_corrections`**

Armazena as correcoes feitas pelo time para cada item nao conforme.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| response_item_id | uuid | FK para `checklist_response_items.id` |
| response_id | uuid | FK para `checklist_responses.id` |
| loja_id | uuid | FK para `config_lojas.id` |
| corrected_by_name | text | Nome de quem corrigiu |
| correction_photo_url | text | URL da foto comprovando a correcao |
| correction_note | text | Observacao opcional sobre a correcao |
| corrected_at | timestamptz | Data/hora da correcao |
| created_at | timestamptz | Timestamp de criacao |

RLS: Sem restricao de autenticacao (acesso publico via Edge Function, assim como o checklist).

**2. Nova Edge Function: `submit-checklist-correction`**

Acoes:
- `fetch`: Recebe um `response_id` e um `access_token`, valida o link, retorna os itens NAO conformes daquela resposta com status de correcao
- `upload-photo`: Faz upload da foto de correcao (mesmo padrao do checklist)
- `submit`: Registra a correcao de um item (nome, foto, observacao)

Validacoes:
- O `access_token` deve ser valido e pertencer ao mesmo link/loja da resposta
- Foto obrigatoria para registrar a correcao
- Nome de quem corrigiu e obrigatorio

**3. Nova pagina: `src/pages/ChecklistCorrections.tsx`**

Rota: `/checklist-corrections/:responseId/:accessToken`

Interface publica (sem login), similar a pagina do checklist:
- Header institucional com logo, nome da unidade e setor
- Lista dos itens NAO conformes com:
  - Texto do item
  - Observacao original do chefe
  - Foto original da nao conformidade
  - Botao "Registrar Correcao" com campo para nome, foto obrigatoria e observacao opcional
- Itens ja corrigidos aparecem com badge verde e data/hora da correcao
- Campo de nome do responsavel (preenchido uma vez, reutilizado para todos os itens)

**4. Geracao do Relatorio PDF com Link**

Adicionar botao "Relatorio NC" no `ChecklistResponsesDashboard` quando uma resposta e expandida e tem itens nao conformes.

O PDF incluira:
- Capa institucional (logo, unidade, setor, data)
- Tabela de itens nao conformes com observacao e peso
- Espaco para anotacoes / delegacao
- QR Code ou link clicavel ao final apontando para a pagina de correcoes
- Texto: "Acesse o link abaixo para registrar as correcoes com foto"

**5. Atualizacao do Dashboard de Respostas**

No drill-down de cada resposta no `ChecklistResponsesDashboard`:
- Itens NAO conformes que ja foram corrigidos mostrarao um badge "Corrigido" com a data
- Link para ver a foto da correcao
- Contagem de correcoes pendentes vs realizadas

---

### Detalhes tecnicos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabela `checklist_corrections` |
| `supabase/functions/submit-checklist-correction/index.ts` | **Novo**: Edge Function para fetch/upload/submit de correcoes |
| `src/pages/ChecklistCorrections.tsx` | **Novo**: Pagina publica de correcoes |
| `src/App.tsx` | Adicionar rota `/checklist-corrections/:responseId/:accessToken` |
| `src/components/checklist-daily/ChecklistResponsesDashboard.tsx` | Adicionar botao "Relatorio NC" e badges de correcao no drill-down |
| `supabase/config.toml` | Adicionar `[functions.submit-checklist-correction]` com `verify_jwt = false` |

### Configuracao de acesso

A Edge Function tera `verify_jwt = false` no config.toml, e validara o `access_token` internamente (mesmo modelo ja usado pelo `submit-daily-checklist`). Isso garante que o time possa acessar a pagina de correcoes sem precisar de login.

### Sobre os links

O link de correcao sera gerado automaticamente a partir do `response_id` e do `access_token` ja existente no link do setor. Exemplo:

```text
https://freelancersgrupocaju.lovable.app/checklist-corrections/{response_id}/{access_token}
```

Nao sera necessario criar novos tokens -- reutilizamos o mesmo `access_token` do link do checklist, validando que o `response_id` pertence ao mesmo link.

