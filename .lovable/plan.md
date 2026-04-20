

## Plano: liberar lançamento livre de freelancers nas escalas

### Diagnóstico do bloqueio atual

No grid de escalas, as linhas **"VAGA EXTRA"** só ficam clicáveis nos dias em que a Matriz POP tem `extras_count > 0`. Nos demais dias a célula vira um traço `—` não-clicável (`ManualScheduleGrid.tsx`, linhas 1085–1126). Resultado: o gestor não consegue lançar freelancer fora da cota prevista — exatamente o problema relatado.

A contagem POP no topo (`getPopTarget` + barra de previsto vs realizado) **não depende dessa restrição** — ela lê direto da `staffing_matrix`. Então liberar a UI **não** afeta a referência de quantos freelancers são necessários.

### Mudanças

#### 1) Sempre exibir um slot livre "Adicionar Freelancer" em todos os dias

Em `ManualScheduleGrid.tsx` (bloco das linhas VAGA EXTRA, ~1050–1128):

- Calcular `slotsToShow = max(extraSlots da matriz, freelancersJáEscalados, 1)` por dia. Hoje é só `extraSlots`.
- A última linha sempre vira **"+ Freelancer livre"** (clicável em qualquer dia, sem traço cinza).
- Quando estiver dentro da cota POP → label "VAGA EXTRA NN" (cor âmbar atual).
- Quando estiver **fora da cota** mas dentro do slot livre → label "EXTRA AVULSO" com cor neutra (cinza), deixando claro que está fora do POP previsto, mas **clicável**.

#### 2) Contador POP no topo permanece como está

A barra/contador acima (`POP Almoço/Jantar` com efetivos + extras) **não muda**. Ela continua refletindo a Matriz POP (`required_count + extras_count`) como meta operacional. Vamos só adicionar um pequeno indicador secundário ao lado quando houver freelancer escalado **acima da cota**:

- Exemplo visual: `Extras: 2/2 ✓ (+1 avulso)` — o `+1 avulso` aparece em cinza apenas se houver freelancer escalado fora da meta POP.

Isso preserva 100% da referência de "quantos são necessários" e acrescenta transparência sobre os lançamentos livres.

#### 3) Modal de freelancer já funciona

`FreelancerAddModal` já aceita qualquer `date` recebida. Não precisa mudar — basta o grid passar a chamá-lo nos dias antes bloqueados.

#### 4) (Opcional, mas recomendado) Botão global "+ Freelancer" no header da semana

Adicionar um botão pequeno no header de cada coluna de dia (ao lado do dia da semana) com ícone `UserPlus` âmbar, que abre o modal já apontando para aquele dia. Atalho rápido para o gestor que está pensando "preciso colocar mais um neste sábado", sem ter que rolar até a seção de vagas extras.

### Arquivos
- **`src/components/escalas/ManualScheduleGrid.tsx`** — único arquivo afetado. Ajustes:
  - bloco "VAGA EXTRA" (~linhas 1050–1128): sempre exibir pelo menos 1 slot clicável por dia.
  - cabeçalho da barra POP (procurar onde `getPopTarget` é renderizado): adicionar contador `(+N avulso)` quando aplicável.
  - cabeçalho de coluna do dia: adicionar botão `+ Freelancer` opcional.

### O que **não** muda
- POP target (efetivos + extras) — mantido como referência operacional.
- Cálculo de conformidade POP — quem está "acima" não conta como déficit.
- Matriz POP em si — segue sendo o "norte" de quantos são necessários.
- Modal `FreelancerAddModal` — já é flexível, sem alterações.
- Lógica de pagamento/budget — escala continua gerando entry em `freelancer_entries` via trigger (integração já feita).

### Validação
- Em qualquer dia da semana, mesmo onde a Matriz POP define `extras_count = 0`, a linha "EXTRA AVULSO" deve aparecer e abrir o modal ao clicar.
- Após lançar 1 freelancer fora da cota: barra POP no topo continua mostrando `Extras: 0/0 ✓`, com indicador `(+1 avulso)` cinza ao lado.
- Em dias com cota POP `extras_count = 2`, comportamento atual preservado: 2 linhas VAGA EXTRA + 1 linha extra avulsa abaixo.
- Conferir que o freelancer escalado aparece imediatamente no Budget Gerencial como "Previsto (Escala)".

