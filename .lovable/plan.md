## Diagnóstico

A planilha enviada não é um POP genérico; ela já é uma base operacional estruturada por abas e, em algumas abas, por mais de uma loja/marca dentro da própria aba.

Exemplos encontrados:

- A planilha tem 12 abas, mas o sistema tem 16 unidades operacionais selecionáveis.
- Há abas diretas: `CAJULIMÃO - ASA NORTE`, `CP ASA NORTE`, `CP ASA SUL`, `NAZO ASS`, `NAZO GOIANIA`, `CAJU ITAIM`.
- Há abas compostas/multi-loja:
  - `CP - NAZO SIG` contém blocos de Caminito SIG e Nazo SIG.
  - `CP - NAZO ÁGUAS CLARAS` contém blocos de Caminito Águas Claras e Nazo Águas Claras.
- O matcher atual casa só por nome de aba. Isso causa erro grave: unidades Foster, Nazo ASA Sul e outras podem cair em abas erradas só porque batem região (`ASA SUL`, `ASA NORTE`, `ÁGUAS CLARAS`).
- A extração atual converte cada aba inteira em CSV e manda para IA. Isso é lento, mistura blocos e ainda depende de a IA interpretar uma estrutura que é melhor lida deterministicamente.

## Objetivo

Trocar o fluxo de “IA lendo tudo por unidade” por um fluxo de importação real para esse modelo de planilha:

1. O cliente anexa a planilha.
2. O sistema lê a planilha automaticamente.
3. O sistema identifica abas, blocos de loja/marca, setores, turnos, dias e valores `X+Y`.
4. O sistema mostra uma revisão clara: o que será importado, quais lojas foram encontradas, quais não foram, e possíveis conflitos.
5. O cliente aplica tudo junto, com segurança, ou corrige unidades individualmente antes de aplicar.

## Plano de implementação

### 1. Criar parser determinístico para “Escala Mínima” em Excel

Criar um módulo específico para essa planilha, sem depender da IA para ler as células.

Ele vai:

- Ler todas as abas do `.xlsx` com a biblioteca já usada no projeto (`xlsx`).
- Detectar cabeçalhos de loja dentro de cada aba, não apenas o nome da aba.
- Detectar blocos de setor pelo padrão:
  - linha de setor
  - linha `TURNO | SEGUNDA | TERÇA | ... | DOMINGO`
  - linha `ALMOÇO`
  - linha `JANTAR`
  - opcionalmente `MANHÃ`/`TARDE`, que serão tratados como produção quando aplicável.
- Converter dias corretamente:
  - coluna `SEGUNDA` → `day_of_week = 1`
  - `TERÇA` → `2`
  - `QUARTA` → `3`
  - `QUINTA` → `4`
  - `SEXTA` → `5`
  - `SÁBADO` → `6`
  - `DOMINGO` → `0`
- Converter turnos:
  - `ALMOÇO`/`MANHÃ` → `almoco`
  - `JANTAR`/`TARDE` → `jantar`
- Interpretar células:
  - `10` → `required_count = 10`, `extras_count = 0`
  - `10+5` → `required_count = 10`, `extras_count = 5`
  - vazio/traço/texto não operacional → ignorar ou marcar como alerta
- Ignorar colunas de orçamento/custo (`Nº pessoas necessárias`, `Nº dobras`, valores em R$, observações), porque a grade precisa dos valores dia × turno.

### 2. Criar mapeamento seguro entre planilha e unidades do sistema

Substituir o matcher atual por um matcher com prioridade e bloqueios.

Regras principais:

- Nunca aceitar match apenas por região se a marca não bater.
- `CP` pode significar Caminito, mas não pode significar Caju nem Foster.
- `NAZO ASS` deve mapear para `NFE 01 - NAZO ASA SUL`.
- `NAZO GYN` deve mapear para `MULT 02 - NAZO GO`.
- `CAJU ITAM`/`CAJU ITAIM` deve mapear para `CAJU - ITAIM`.
- Abas compostas precisam gerar sub-blocos:
  - `CP - NAZO SIG`:
    - blocos `... CAMINITO` → `MULT 03 - CAMINITO SIG`
    - blocos `... NAZO` / `SUSHI NAZO` → `NFE 04 - NAZO SIG`
  - `CP - NAZO ÁGUAS CLARAS`:
    - blocos sem `NAZO` ou com `CAMINITO` → `MULT 12 - CAMINITO AGUAS CLARAS`
    - blocos com `NAZO` / `SUSHI NAZO` → `NFE 03 - NAZO AGUAS CLARAS`
- Unidades sem fonte clara ficam como “não encontradas”, não recebem dados de outra loja por aproximação.
- Foster’s não deve ser preenchido a partir de abas de Caju/Caminito/Nazo.

### 3. Mapear nomes de setores da planilha para `sector_key`

Criar normalização robusta:

- `GARÇOM`, `GARÇOM + CHEFIAS`, `ATENDIMENTO`, `ATENDIMENTO CAMINITO`, `ATENDIMENTO NAZO` → conforme regra segura:
  - quando for apenas atendimento misto, mapear para `garcom`, e manter alerta se incluir chefias agregadas.
- `CHEFE`, `SUBCHEFE`, `CHEFE E SUBCHEFE DE SALÃO` → `chefe_subchefe_salao`
- `CUMIN`, `CUMINS`, `CUMINS NAZO`, `CUMINS CAMINITO` → `cumin`
- `HOSTESS` → `hostess`
- `CAIXA/DELIVERY`, `DELIVERY` → `caixa_delivery`
- `PARRILLA` → `parrilla`
- `COZINHA`, `COZINHA NAZO`, `COZINHA CAMINITO` → `cozinha`
- `BAR` → `bar`
- `SERVIÇOS GERAIS`, `SERVIÇO GERAIS`, `ASG` → `servicos_gerais_salao_bar`
- `PRODUÇÃO`, `PRODUÇÃO 6X1`, `PRODUÇÃO DE SUSHI` → `producao` ou `sushi` quando claramente sushi
- `SUSHI NAZO` → `sushi`

Qualquer setor não reconhecido entra em alerta e não é gravado automaticamente.

### 4. Criar uma etapa de revisão com boa usabilidade

No painel Multi-unidade, após anexar a planilha, em vez de ir direto para “processar IA”, mostrar uma prévia de importação:

- Resumo geral:
  - abas lidas
  - unidades encontradas
  - unidades sem dados
  - quantidade de células válidas
  - alertas
- Lista por unidade:
  - status: encontrada / não encontrada / conflito / pronta
  - origem: aba + bloco detectado
  - quantidade de células que serão aplicadas
  - botão para expandir e ver a prévia da grade
- Alertas visíveis:
  - loja não encontrada
  - setor não reconhecido
  - célula inválida
  - aba composta separada em múltiplas unidades
  - unidade selecionada sem dados na planilha

O cliente deve conseguir entender antes de salvar:

```text
Planilha lida
12 abas detectadas
10 unidades encontradas
6 unidades sem dados
1.128 células prontas para aplicar
8 alertas para revisar
```

### 5. Aplicação conjunta com segurança

Adicionar um botão principal:

- `Aplicar importação validada`

Comportamento:

- Aplica todas as unidades que estão com status “pronta”.
- Não aplica unidades com conflito ou sem dados.
- Mantém a lógica atual de `upsert` em `holding_staffing_config`.
- Invalida o cache da grade após salvar.
- Mostra resultado final por unidade:
  - aplicada
  - ignorada
  - falhou

Importante: isso substitui o “puxar automático antes de ler”. O sistema só habilita aplicação depois que a planilha foi lida e validada.

### 6. Manter IA apenas como fallback

A IA/Gemini deve continuar útil para PDF, imagem ou arquivos não estruturados.

Mas para `.xlsx` neste formato:

- caminho principal = parser determinístico
- IA = fallback opcional, não fluxo principal

Isso melhora:

- velocidade
- custo
- precisão
- previsibilidade
- confiança do cliente

## Arquivos previstos

Criar:

- `src/lib/holding/minimum-scale-parser.ts`
- `src/lib/holding/unit-sheet-resolver.ts`
- `src/components/escalas/holding/MinimumScaleImportReview.tsx`

Editar:

- `src/lib/extract-attachment-text.ts`
- `src/lib/holding/sheet-matcher.ts` ou substituir seu uso pelo novo resolver seguro
- `src/hooks/usePOPWizardBatch.ts`
- `src/components/escalas/holding/POPWizardMultiPanel.tsx`
- possivelmente `UnitProposalCard.tsx` para exibir origem/alertas da importação

## Resultado esperado

Depois da alteração, ao anexar a planilha enviada:

- O sistema não vai mais tentar preencher Foster com aba de Caminito/Nazo/Caju.
- O sistema vai separar abas compostas como SIG e Águas Claras por blocos internos.
- O cliente verá uma revisão antes de aplicar.
- A aplicação será conjunta, mas somente depois de leitura e validação.
- As lojas sem dados reais na planilha ficarão claramente marcadas como “sem dados”, em vez de receberem dados errados.