## Diagnóstico da causa raiz

A falha não é só da IA: é da regra de pós-processamento e do prompt.

O gerador hoje está tratando o POP de almoço e jantar como se fossem pessoas/slots independentes demais, e depois ainda força a criação de vagas extras de almoço. No caso real:

- POP cadastrado de GARCOM chega a 23 no almoço e 22 no jantar.
- Matematicamente, com escala 6x1, a necessidade mínima semanal usando dobras quando possível fica perto de 22 a 26 pessoas, não 47.
- O template salvo mostra 38 vagas `TIPO-ALMOCO` + 9 `TIPO-FECHAMENTO`, ou seja: almoço foi duplicado em vez de reaproveitar dobras/turnos que cobrem almoço e jantar.
- Além disso, o sistema está lendo `headcount_max=2` porque o setor `GARÇOM` está vinculado ao cargo `Garcom` com 2 ativos, enquanto existe outro cargo `Garçom` com 20 ativos não vinculado ao setor. Isso explica o alerta errado de 2 pessoas, mas não justifica as 47 vagas — são dois bugs separados.

## Correção definitiva proposta

### 1. Corrigir a fonte do teto de garçons
- Ajustar a resolução de headcount para considerar cargos equivalentes por normalização robusta (`GARCOM`, `GARÇOM`, variações com/sem acento e plural).
- Se o setor for GARCOM/GARÇOM, somar cargos compatíveis vinculados e equivalentes da unidade, evitando contar só o cargo errado.
- Manter alerta se o vínculo de cargo estiver incompleto: “Setor GARÇOM tem cargo Garcom vinculado, mas há Garçom ativo fora do vínculo”.

### 2. Trocar a lógica de “injetar almoço” por “dimensionar por cobertura mínima”
- Remover a lógica atual que adiciona vagas de almoço em loop até cobrir, pois ela cria duplicação.
- Implementar um cálculo determinístico antes/depois da IA:
  - Para cada dia, calcular `pop_almoco`, `pop_jantar` e `demanda_minima_dia = max(pop_almoco, pop_jantar)` quando a jornada puder cobrir ambos.
  - Para dias Tipo C (fechamento 02h30), separar `fechadores_puros` apenas na quantidade necessária para fechamento, mas não duplicar todo o POP de almoço.
  - Usar 6x1/5x2 para calcular o número semanal mínimo: `ceil(soma_demanda_pessoa_dia / dias_uteis_por_pessoa)`.
  - Limitar `plano_folgas.vagas` ao `headcountMax` quando `headcountMax` for suficiente para a demanda mínima.

### 3. Fazer a IA gerar horários, não inventar headcount ilimitado
- Atualizar o prompt para deixar claro:
  - A função da IA é desenhar horários dentro do teto real de pessoas sempre que matematicamente possível.
  - POP é obrigatório, mas deve ser cumprido com dobras e reaproveitamento de pessoas, não criando uma vaga nova para cada turno.
  - `TIPO-ALMOCO` puro só entra quando faltou cobertura de almoço depois de usar dobras viáveis.
  - Se `headcountMax` for menor que o mínimo matemático, reduzir folgas/modelo e gerar alerta, não explodir vagas.

### 4. Criar um validador de capacidade final
- Depois da resposta da IA, recalcular:
  - quantidade total de vagas;
  - cobertura almoço por dia;
  - cobertura jantar por dia;
  - folgas por dia;
  - déficit real contra o teto.
- Se `vagas > headcountMax` e `headcountMax >= minimo_matematico`, podar/compactar vagas redundantes antes de salvar.
- Se `vagas > headcountMax` e `headcountMax < minimo_matematico`, manter somente o mínimo matemático e emitir alerta operacional.

### 5. Exibir diagnóstico claro no front
- Mostrar no painel do gerador:
  - `Garçons ativos considerados: 26`;
  - `Mínimo matemático para POP: X`;
  - `Vagas geradas: Y`;
  - alertas de cargo desvinculado ou POP impossível.

## Resultado esperado

Para o cenário citado:

- O sistema deve reconhecer 26 garçons, não 2.
- A IA não deve sugerir 47 vagas.
- A escala deve ficar limitada ao teto real quando o teto cobre o POP.
- Todos os dias continuam garantindo abertura, fechamento e POP de almoço às 11h30.
- Se algum dia realmente exigir mais que 26, o sistema gera alerta objetivo, sem inventar 47 espaços.