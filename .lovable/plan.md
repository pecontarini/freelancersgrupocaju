
## Plano: acabar de vez com reaparecimento, duplicidade e poluição visual no Editor de Escalas

### Diagnóstico do problema atual

Hoje a grade mistura 3 coisas diferentes na mesma lista:
1. pessoas realmente lançadas na semana
2. CLTs do quadro base do setor
3. ocultação temporária via `hiddenEmployeeIds`

Isso gera a sensação de que o botão “excluir” não salvou, porque:
- a linha some só localmente e depois volta
- CLTs vinculados ao setor continuam reaparecendo mesmo sem escala ativa
- o cadastro de freelancer e o insert de escala ainda permitem duplicações futuras
- não existem travas no banco para impedir duplicidade de escala ativa ou freelancer por CPF

Além disso, a remoção atual “parece” funcionar visualmente antes de confirmar sucesso no backend, o que mascara erro e faz o problema voltar depois.

## Solução definitiva

### 1. Separar visualmente “Escala da semana” de “Base do setor”
No `ManualScheduleGrid.tsx`, trocar a lista única por duas camadas:

- **Escala da semana**: mostra apenas quem tem lançamento ativo na semana/setor atual
- **Base do setor**: seção secundária/colapsada com CLTs vinculados ao setor, mas sem lançamento na semana

Resultado:
- ao excluir alguém da semana, ele sai da área principal e não volta “fantasma”
- o usuário entende claramente quem está escalado versus quem só pertence ao setor
- a visualização fica muito mais limpa

### 2. Remover dependência do `hiddenEmployeeIds` como fonte da verdade
O `hiddenEmployeeIds` deve deixar de ser a base da remoção visual.

Novo comportamento:
- a grade principal passa a ser derivada dos lançamentos reais da semana
- o estado local vira apenas otimização temporária, com rollback se houver erro
- ao trocar semana/setor/unidade, a tela continua consistente porque depende do dado real, não de memória local

### 3. Corrigir o fluxo do botão “Remover da semana”
No fluxo de exclusão:

- só fechar o modal depois do sucesso real da mutação
- mostrar loading no botão
- aplicar otimização visual com rollback em erro
- deixar explícito o escopo da ação:
  - **remover deste setor na semana**
  - e só usar remoção ampla se isso for intencional

Isso elimina a falsa percepção de “apagou mas voltou”.

### 4. Tornar a gravação de escala idempotente
Em `useUpsertSchedule`, parar de fazer insert cego.

Novo comportamento:
- se já existir escala ativa para `employee + date + sector`, atualizar
- se existir uma cancelada equivalente, reativar/atualizar
- só inserir nova linha quando realmente não houver registro para aquela célula

Isso evita duplicidade de lançamentos no mesmo dia/setor.

### 5. Impedir duplicidade na origem (banco)
Adicionar migração com travas definitivas:

- **índice único parcial em `schedules`**
  - uma única escala ativa por `employee_id + schedule_date + sector_id`
- **índice único parcial em `employees` para freelancer por CPF na unidade**
  - evita criar o mesmo freelancer várias vezes

Como verifiquei a estrutura atual, `employees` e `schedules` não têm essas proteções hoje. As políticas de acesso já existem, então não deve exigir mudança de permissão.

### 6. Blindar o cadastro de freelancer no modal
No `FreelancerAddModal.tsx`:

- antes de criar novo freelancer, buscar por CPF na unidade
- se já existir, reutilizar o cadastro existente em vez de criar outro
- se o freelancer já estiver lançado naquele dia/setor, abrir edição em vez de inserir de novo

Isso corta o problema de nomes duplicados na raiz.

### 7. Acabamento visual para eliminar “poluição”
No grid:

- seção principal com badge de contagem: “Escalados nesta semana”
- seção secundária colapsável: “Quadro base do setor”
- badge para casos detectados de identidade repetida: “cadastro duplicado”
- mensagem clara quando a pessoa não está mais escalada, em vez de simplesmente reaparecer vazia

```text
Editor de Escalas
├─ Escalados nesta semana
│  ├─ linhas reais da semana
│  └─ excluir remove daqui de forma definitiva
└─ Base do setor
   ├─ CLTs do setor sem lançamento
   └─ seção secundária, recolhida por padrão
```

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/components/escalas/ManualScheduleGrid.tsx` | reconstruir a lógica visual da grade |
| `src/hooks/useManualSchedules.ts` | tornar gravação e exclusão determinísticas |
| `src/components/escalas/FreelancerAddModal.tsx` | impedir criação duplicada de freelancer |
| Migração SQL | adicionar unicidade parcial para schedules e freelancers |

## Resultado esperado

Depois dessa mudança:
- excluir da semana passa a refletir no dado real
- a pessoa não volta como “fantasma”
- nomes duplicados deixam de surgir
- o grid fica limpo, com foco em quem está realmente escalado
- o quadro base continua disponível, mas sem poluir a visualização principal

## Detalhes técnicos
- Não preciso mudar autenticação nem políticas para isso; o backend já tem regras de acesso em `employees` e `schedules`.
- A correção definitiva depende de **UI + lógica de gravação + trava no banco**. Fazer só front-end não basta.
- Na leitura atual, não encontrei índices de unicidade nessas tabelas, então hoje o sistema ainda permite duplicação por desenho.
