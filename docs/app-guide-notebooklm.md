# Portal da Liderança — Grupo Caju

## Guia Completo do Sistema

Este documento descreve, tela por tela, como funciona o Portal da Liderança do Grupo Caju. Ele foi escrito em linguagem natural para servir como fonte de conhecimento no NotebookLM e gerar áudios ou vídeos explicativos sobre o sistema.

---

## 1. Introdução e Visão Geral

O Portal da Liderança é uma plataforma de gestão operacional criada para o Grupo Caju, que reúne quatro marcas de restaurantes: **Caju Limão**, **Caminito Parrilla**, **Nazo Japanese** e **Foster's Burguer**. Cada marca pode ter uma ou mais unidades (lojas) espalhadas pela cidade.

O objetivo do portal é centralizar tudo o que um líder operacional precisa no dia a dia: controlar gastos, acompanhar a performance da equipe, gerenciar escalas de trabalho, monitorar auditorias de qualidade, controlar o custo dos insumos e muito mais. Em vez de depender de planilhas espalhadas e comunicação informal, o portal concentra todas essas informações em um só lugar, com dashboards visuais, alertas automáticos e relatórios prontos para exportar.

O sistema é acessado pelo navegador, funciona tanto no computador quanto no celular, e cada pessoa vê apenas o que é relevante para o seu papel na operação.

---

## 2. Perfis de Acesso

O portal possui cinco perfis de acesso, cada um com permissões diferentes:

### Administrador (Admin)

O administrador tem acesso total ao sistema. Ele pode ver todas as unidades, todas as abas, editar configurações, aprovar usuários, gerenciar budgets e acessar dashboards consolidados de toda a rede. É o perfil usado pelos sócios fundadores ou pela equipe de gestão central do grupo.

### Sócio Operador (Operator)

O sócio operador tem acesso muito semelhante ao do administrador, mas restrito às lojas que estão vinculadas ao seu perfil. Ele pode ver e editar budgets, acompanhar performance, acessar auditorias e escalas — tudo referente às suas unidades. É o perfil ideal para sócios que operam um conjunto específico de lojas.

### Gerente de Unidade

O gerente de unidade tem acesso operacional às lojas vinculadas ao seu perfil. Ele pode visualizar budgets, lançar despesas, acompanhar auditorias, gerenciar escalas e controlar o CMV da sua unidade. Ao entrar no sistema, a loja do gerente já é selecionada automaticamente, facilitando o uso no dia a dia.

### Chefe de Setor

O chefe de setor tem acesso restrito apenas à aba de Escalas. Ele pode visualizar e editar a escala do seu setor, conferir a equipe escalada para cada dia e acompanhar confirmações de turno. Esse perfil é pensado para líderes de cozinha, salão ou bar que precisam apenas gerenciar a escala do seu time.

### Colaborador (Employee)

O colaborador não acessa o portal diretamente. Ele recebe um link por WhatsApp para confirmar ou recusar o turno escalado para o dia seguinte. Também pode receber links para preencher checklists diários de qualidade. Toda a interação do colaborador acontece por páginas externas, sem necessidade de login.

---

## 3. Tela de Login

Ao abrir o portal, o usuário encontra a tela de login com os campos de e-mail e senha. Usuários que já possuem conta podem fazer login normalmente.

Para novos usuários, existe a opção de criar uma conta. Porém, ao se cadastrar, o novo usuário não recebe acesso imediato. Sua conta fica pendente até que um administrador aprove o acesso e atribua o perfil correto (gerente, operador, chefe de setor, etc.) e as lojas correspondentes. Isso garante que ninguém acesse o sistema sem autorização.

Após o login, o sistema identifica o perfil do usuário e direciona automaticamente para a tela correta. Por exemplo, um chefe de setor é direcionado direto para a aba de Escalas, enquanto um gerente vê a aba de Budgets Gerenciais como tela inicial.

---

## 4. Aba: Budgets Gerenciais

A aba de Budgets Gerenciais é a tela principal para o controle diário de gastos operacionais de cada unidade. Ela é a primeira coisa que gerentes e operadores veem ao entrar no sistema.

### Cards de Resumo

No topo da tela, existem cards que mostram o resumo financeiro do mês: o total gasto com freelancers (profissionais temporários contratados por diária), o total de despesas operacionais, o total de manutenções, e o valor total consolidado. Cada card mostra o valor acumulado e uma indicação visual de quanto do budget mensal já foi consumido.

### Barra de Consumo Diário

Logo abaixo dos cards, uma barra de progresso mostra visualmente quanto do budget diário já foi utilizado. Isso permite que o gerente saiba, a qualquer momento do dia, se está dentro ou fora do orçamento planejado.

### Lançamento de Despesas

O gerente pode registrar três tipos de despesas:

**Freelancers**: Para cada freelancer contratado, o gerente preenche o nome completo, CPF, chave PIX, função exercida, gerência responsável, data do trabalho e valor da diária. O sistema armazena esses dados para gerar relatórios e solicitações de pagamento.

**Despesas Operacionais**: São gastos do dia a dia da operação, como compras de materiais, transporte, ou pequenos reparos. O gerente informa a descrição, o valor, a data e a categoria da despesa.

**Manutenção**: Para registrar serviços de manutenção realizados na unidade, como conserto de equipamentos, reparos elétricos ou hidráulicos. Inclui informações como o tipo de serviço, o fornecedor, o valor e se foi emergencial ou programado.

### Filtros e Visualização

A tela oferece filtros por período, função e gerência, permitindo que o gerente visualize apenas os lançamentos que deseja. Uma tabela lista todos os lançamentos do período selecionado, com opções de editar ou excluir.

### Gráfico de Evolução de Custos

Um gráfico de linhas mostra a evolução dos gastos ao longo do mês, comparando freelancers, despesas operacionais e manutenção. Isso ajuda a identificar tendências e picos de gasto.

### Card de Saúde Financeira

Um card especial mostra a saúde financeira da unidade, indicando se os gastos estão dentro do esperado, se há risco de estourar o budget, ou se a unidade está em situação confortável.

### Editar Budgets

Sócios operadores e administradores têm acesso ao botão "Editar Budgets", que permite alterar o orçamento mensal da unidade. Ao clicar, o sistema pede uma senha de verificação para garantir que apenas pessoas autorizadas modifiquem os valores. O editor inline permite ajustar o budget diretamente na tela, sem sair da aba.

### Exportação

Todos os dados podem ser exportados em formato PDF, gerando um relatório completo dos gastos do período para impressão ou envio por e-mail.

### Card de Prontidão da Equipe

No topo da aba de Budgets, existe também um card chamado "Prontidão da Equipe", que mostra se a escala do dia seguinte está completa e se todos os colaboradores confirmaram presença. Se houver pendências, o card direciona o gerente para a aba de Escalas para resolver.

---

## 5. Aba: Remuneração Variável

A aba de Remuneração Variável é onde gerentes e operadores acompanham o sistema de bônus mensal da equipe de liderança. O Grupo Caju possui um programa de remuneração variável que premia os líderes com base na performance da unidade em diferentes indicadores.

### Simulador de Bônus

O simulador permite que o usuário ajuste os valores de cada indicador usando controles deslizantes e veja, em tempo real, qual seria o bônus calculado. Os indicadores incluem faturamento do salão, faturamento do delivery, número de reclamações, nota da supervisão de auditoria, tempo médio de comanda, entre outros.

### Cálculo por Cargo

O bônus é calculado de forma diferente para cada cargo. Por exemplo, o Gerente de Frente (responsável pelo salão) tem seus indicadores focados em atendimento e satisfação do cliente, enquanto o Gerente de Back (responsável pela cozinha) tem indicadores voltados para qualidade da comida e controle de custos. As chefias de setor também possuem seus próprios critérios.

### Tiers de Performance

O resultado do cálculo classifica cada pessoa em um dos quatro tiers de performance:

- **Ouro**: performance excepcional, bônus máximo
- **Prata**: boa performance, bônus intermediário
- **Bronze**: performance mínima aceitável, bônus reduzido
- **Red Flag**: performance abaixo do mínimo, sem bônus

### Ranking de Lojas

Um ranking compara todas as unidades da rede, mostrando quais estão melhor posicionadas em cada indicador. Isso cria uma competição saudável entre as lojas e incentiva a busca por melhoria contínua.

### Feed de Alertas e Conquistas

Um feed em tempo real mostra alertas sobre mudanças de tier, conquistas alcançadas (como "melhor nota de supervisão do mês") e avisos sobre indicadores que estão caindo. No celular, esse feed aparece em formato de cards deslizáveis, facilitando a visualização rápida.

### Lançamento Semanal

Administradores podem lançar os dados semanais de performance de cada unidade. Esses dados alimentam o simulador e o ranking, mantendo tudo atualizado.

---

## 6. Aba: Diagnóstico de Auditoria

A aba de Diagnóstico de Auditoria é onde o sistema processa e analisa os resultados das auditorias de supervisão realizadas nas unidades. Essas auditorias são checklists detalhados que avaliam dezenas de itens de qualidade, higiene, atendimento e processos.

### Upload de Checklists

O gerente ou administrador pode fazer upload de checklists em formato PDF ou planilha. O sistema extrai automaticamente os dados do arquivo, identifica os itens avaliados, as notas atribuídas e as não conformidades encontradas. Todo o processamento acontece de forma inteligente, reconhecendo diferentes formatos de checklist.

### KPIs Principais

Quatro indicadores principais aparecem no topo da tela:
- **Nota Média**: a média das notas de todas as auditorias do período
- **Total de Auditorias**: quantas auditorias foram realizadas
- **Total de Falhas**: quantas não conformidades foram encontradas
- **Setor Crítico**: qual setor teve mais falhas no período

### Gráfico de Evolução

Um gráfico de linhas mostra como as notas de auditoria evoluíram ao longo do tempo. Isso permite identificar se a unidade está melhorando, piorando ou mantendo a mesma qualidade.

### Ranking de Recorrências

Uma lista mostra quais itens de checklist falham com mais frequência. Por exemplo, se o item "temperatura da geladeira" está reprovando em todas as auditorias, ele aparece no topo do ranking. Isso ajuda o gerente a focar nos problemas mais recorrentes.

### Histórico de Auditorias

Uma tabela completa lista todas as auditorias realizadas, com data, nota geral, quantidade de falhas e a possibilidade de clicar para ver o detalhamento completo de cada auditoria — item por item, com as observações registradas.

### Relatórios PDF

O sistema gera relatórios em PDF de duas formas: por unidade (mostrando todas as auditorias de uma loja no período) e por setor (focando em um setor específico como cozinha, salão ou bar). Os relatórios incluem gráficos, tabelas e análises prontas para impressão.

### Análise com Inteligência Artificial

Um botão especial permite solicitar uma análise por inteligência artificial. O sistema envia os dados das auditorias para um modelo de IA que identifica padrões, correlações entre falhas e sugere ações prioritárias. O resultado é apresentado em texto, como se fosse um consultor analisando os dados.

### Filtros

A tela oferece filtros por período, marca e loja, permitindo análises segmentadas. O administrador pode ver toda a rede de uma vez ou focar em uma unidade específica.

### Sub-aba: Checklist Diário

Dentro do Diagnóstico de Auditoria, existe uma sub-aba dedicada ao Checklist Diário. Aqui, o administrador pode:

- **Criar templates de checklist**: definir quais itens devem ser verificados diariamente em cada setor
- **Gerar links**: cada setor de cada loja recebe um link único que pode ser enviado por WhatsApp para o responsável
- **Ver respostas**: um dashboard mostra todas as respostas recebidas, com nota de conformidade, itens reprovados e fotos de evidência

O checklist diário é diferente da auditoria de supervisão. A auditoria é feita periodicamente por um supervisor externo, enquanto o checklist diário é preenchido pela própria equipe da loja como rotina de autoavaliação.

---

## 7. Aba: Performance da Liderança

A aba de Performance da Liderança apresenta um diagnóstico hierárquico que mostra quais responsáveis (gerentes, chefes de setor) estão acumulando mais falhas recorrentes nas auditorias.

O sistema cruza os dados das auditorias com o mapeamento de responsabilidades de cada cargo. Por exemplo, se os itens de "limpeza do salão" estão sempre reprovados, o sistema identifica que o responsável por esse setor é o Chefe de Salão e mostra essa informação no dashboard.

Isso permite que o administrador ou sócio operador tenha uma visão clara de onde estão os gargalos de liderança e possa tomar ações direcionadas, como treinamentos, feedbacks ou mudanças de função.

O dashboard pode ser filtrado por unidade e mostra scores individuais por cargo, com classificação em tiers (similar ao sistema de bônus).

---

## 8. Aba: CMV (Unitários)

A aba de CMV (Custo de Mercadoria Vendida) é uma ferramenta completa para controle de insumos e estoque de cada unidade. O CMV é um dos indicadores mais importantes de um restaurante, pois mede quanto se gasta em ingredientes em relação ao que se vende.

### Contagem Diária de Estoque

O gerente ou responsável pela cozinha pode registrar a contagem física dos itens de estoque. A tela apresenta uma lista com todos os itens cadastrados (carnes, bebidas, descartáveis, etc.) e campos para inserir a quantidade encontrada. O sistema salva o preço de custo vigente no momento da contagem para cálculos futuros.

### Processamento de Notas Fiscais (NF-e)

Quando a unidade recebe mercadorias de fornecedores, o gerente pode fazer upload da nota fiscal eletrônica (em formato XML ou como imagem/foto). O sistema extrai automaticamente os itens da nota, as quantidades, os preços unitários e registra tudo como entrada de estoque. Se um item da nota não estiver cadastrado no sistema, ele é sinalizado para mapeamento.

### Dashboard de Vendas

O sistema pode importar relatórios de vendas (do sistema de PDV ou caixa) para saber exatamente o que foi vendido no dia. Essa informação é cruzada com o estoque para calcular o consumo teórico de cada ingrediente.

### Kardex

O Kardex é um relatório que mostra todas as movimentações de cada item: entradas (compras via NF-e), saídas (vendas), contagens físicas e ajustes. É como um extrato bancário, mas para o estoque. O gerente pode ver dia a dia o que entrou, o que saiu e o saldo remanescente.

### Auditoria de Período

O sistema permite abrir e fechar períodos de contagem (por exemplo, uma semana). No início do período, registra-se o estoque de abertura. No final, registra-se o estoque de fechamento. O sistema calcula automaticamente:
- Quanto deveria ter sido consumido (com base nas vendas)
- Quanto realmente foi consumido (com base na diferença de estoque)
- A divergência entre os dois valores

Essa divergência é o indicador principal de desperdício, roubo ou erro de processo.

### Relatório de Fechamento

Ao encerrar um período, o sistema gera um relatório completo mostrando o CMV real versus o teórico, item por item, com os valores em reais e percentuais. Esse relatório pode ser exportado.

### Mapeamento de Produtos

O sistema possui dois tipos de mapeamento:

**Mapeamento de NF-e**: vincula o nome do produto como aparece na nota fiscal ao item correspondente no cadastro do sistema. Por exemplo, "FILÉ MIGNON ANGUS KG" na nota fiscal é mapeado para "Filé Mignon" no sistema.

**Mapeamento de Vendas**: vincula o nome do prato vendido aos ingredientes que ele consome. Por exemplo, "X-Burguer Especial" consome 200g de carne, 2 fatias de queijo, 1 pão, etc.

### Cadastro de Itens e Histórico de Preços

O administrador pode cadastrar novos itens de CMV, definindo nome, unidade de medida, categoria e preço de custo. O sistema mantém um histórico de todas as variações de preço de cada item, mostrando quando e por quanto o preço mudou.

### Alertas de Itens Não Mapeados

Quando o sistema identifica itens de vendas ou notas fiscais que ainda não foram mapeados, exibe um alerta visual pedindo que o gerente faça o mapeamento. Isso garante que o cálculo de CMV seja o mais preciso possível.

---

## 9. Aba: Escalas

A aba de Escalas é onde toda a gestão de turnos e equipe acontece. Ela é dividida em seis sub-abas:

### Editor de Escalas

O editor de escalas apresenta uma grade semanal onde cada linha é um colaborador e cada coluna é um dia da semana. O gerente pode definir para cada pessoa se ela trabalha no turno do almoço, jantar, dupla (almoço e jantar), folga ou folga compensatória. A interface é visual e intuitiva, com cores diferentes para cada tipo de turno.

O editor também valida regras trabalhistas da CLT, como o limite de seis dias consecutivos de trabalho e a necessidade de pelo menos uma folga semanal.

### Gestão D-1

A Gestão D-1 (dia menos um) é focada na preparação do dia seguinte. Nessa tela, o gerente pode:
- Ver a lista de todos os colaboradores escalados para o dia seguinte
- Enviar lembretes via WhatsApp pedindo confirmação de presença
- Acompanhar o status de cada confirmação (confirmado, pendente, recusado)
- Identificar riscos de desfalque na equipe

Se há colaboradores que não confirmaram ou que recusaram o turno, um indicador visual aparece na aba principal de Escalas, alertando o gerente.

### Quadro Operacional

O quadro operacional mostra a situação em tempo real de cada turno: quantas pessoas estão escaladas para o almoço, quantas para o jantar, qual o efetivo mínimo necessário por setor e se há algum setor abaixo do mínimo. É como um painel de controle que o gerente consulta durante o expediente.

### Equipe

A sub-aba de Equipe é o cadastro de todos os colaboradores da unidade. Cada colaborador tem nome, cargo, setor, telefone, gênero e tipo de contrato (CLT ou freelancer). Daqui é possível adicionar novos membros, editar informações e desativar colaboradores que saíram.

### Cargos e Setores

Nessa tela, o administrador define o mapeamento entre cargos e setores. Por exemplo, o cargo "Cozinheiro" pertence ao setor "Cozinha", enquanto "Garçom" pertence ao setor "Salão". Esse mapeamento é usado pelo quadro operacional para calcular o efetivo por setor.

### Configurações (Matriz de Efetivo)

Aqui o administrador define a matriz de efetivo mínimo: quantas pessoas de cada cargo são necessárias em cada turno. Por exemplo, o turno do almoço precisa de no mínimo 2 cozinheiros, 3 garçons e 1 barman. Essas regras alimentam o quadro operacional e geram alertas quando a escala não atinge o mínimo.

---

## 10. Aba: Dores da Operação (somente Admin)

A aba de Dores da Operação é exclusiva para administradores e funciona como uma central de gestão de reclamações de clientes.

### Central de Reclamações

Uma lista mostra todas as reclamações registradas, organizadas por data, loja, tipo de problema e status de resolução. O administrador pode filtrar por período, loja ou tipo de reclamação.

### Upload com Inteligência Artificial

O administrador pode fazer upload de screenshots de reclamações recebidas pelo Google, iFood, TripAdvisor ou redes sociais. O sistema usa inteligência artificial para extrair automaticamente as informações relevantes: a nota dada pelo cliente, o texto da reclamação, a fonte (de onde veio) e classifica o tipo de problema.

### Entrada por Voz

Também é possível registrar reclamações por voz. O administrador fala o que aconteceu e o sistema transcreve e categoriza automaticamente.

### Gráfico de Pareto

Um gráfico de Pareto mostra quais tipos de reclamação são mais frequentes, seguindo o princípio de que 80% dos problemas vêm de 20% das causas. Isso ajuda o administrador a priorizar ações.

### Diagnóstico por Loja

Cada loja tem um card de diagnóstico que mostra quantas reclamações recebeu, quais são os problemas mais comuns e qual é a tendência (melhorando ou piorando).

### Planos de Ação

Para cada reclamação ou grupo de reclamações, o administrador pode criar um plano de ação com: causa raiz identificada, medida tomada, ação preventiva para evitar recorrência, prazo de resolução e responsável. O plano de ação passa por um fluxo de resolução (pendente → em andamento → resolvido → validado) e pode receber comentários e acompanhamento.

---

## 11. Aba: Configurações (somente Admin)

A aba de Configurações é o painel de controle do sistema, acessível apenas para administradores.

### Orçamento por Loja

O administrador define o budget operacional mensal de cada loja. Esse valor é usado como referência na aba de Budgets Gerenciais para calcular a barra de consumo e os indicadores de saúde financeira.

### Cadastro de Cargos

Uma lista completa de todos os cargos do grupo, com informações como: nome do cargo, categoria (liderança, operacional), família operacional (frente ou back), setor, pote de variável máximo (quanto de bônus o cargo pode receber) e quais marcas o cargo se aplica.

### Regras de Bônus

Configuração das regras de cálculo do bônus para cada cargo e tier. Define qual percentual do bônus base cada tier recebe.

### Sincronização com Google Sheets

O sistema pode se conectar a planilhas do Google Sheets para importar dados automaticamente. Essa seção permite configurar os links das planilhas e definir a frequência de sincronização.

### Importação de Checklists

Ferramenta para importar templates de checklist de auditoria a partir de planilhas, configurando os itens, pesos e setores correspondentes.

### Gerenciamento de Lojas, Funções e Gerências

O administrador pode cadastrar, editar e desativar lojas, funções (freelancer) e gerências (áreas de responsabilidade). Essas opções alimentam os formulários de lançamento e os filtros do sistema.

### Gerenciamento de Usuários

A seção mais importante das configurações. Aqui o administrador pode:
- Ver todos os usuários cadastrados
- Aprovar novos cadastros pendentes
- Atribuir perfis de acesso (admin, operador, gerente, chefe de setor)
- Vincular usuários às suas respectivas lojas
- Desativar acessos

---

## 12. Aba: Visão Rede (somente Admin)

A aba de Visão Rede é o dashboard executivo que consolida os dados de todas as unidades em uma única visão.

### KPIs Globais

No topo, quatro indicadores principais mostram a saúde geral da rede:
- **Supervisão Média**: a nota média de auditoria de toda a rede
- **Reclamações**: total de reclamações recebidas no período
- **Taxa de Resolução**: percentual de planos de ação resolvidos
- **Eficiência Financeira**: comparação entre gastos planejados e realizados

### Ranking de Lojas

Duas listas lado a lado mostram as melhores e piores lojas em dois critérios: nota de supervisão e volume de reclamações. Isso permite que o administrador identifique rapidamente quais unidades precisam de mais atenção.

### Matriz de Severidade

Uma matriz visual cruza a frequência de problemas com a gravidade, classificando cada tipo de ocorrência em quatro quadrantes: baixa frequência/baixa gravidade, alta frequência/baixa gravidade, baixa frequência/alta gravidade e alta frequência/alta gravidade. Os problemas no quadrante de alta frequência e alta gravidade são os prioritários.

### Pareto Global

Similar ao Pareto da aba de Dores da Operação, mas consolidando dados de toda a rede. Mostra quais tipos de problema são mais frequentes quando se olha todas as lojas juntas.

### Lead Time de Resolução

Um indicador que mostra quanto tempo, em média, a rede leva para resolver um plano de ação, desde a abertura até a validação final. Esse número ajuda a medir a agilidade da operação em responder a problemas.

---

## 13. Páginas Externas (sem login)

O portal possui três páginas que funcionam sem necessidade de login, acessadas via links compartilhados:

### Confirmação de Turno

Endereço: `/confirm-shift/:id`

Quando o gerente envia o link de confirmação pelo WhatsApp, o colaborador abre essa página e vê os detalhes do turno escalado: data, horário, setor e função. Ele pode confirmar que estará presente ou recusar o turno, informando o motivo. A resposta é registrada automaticamente no sistema e atualiza o painel de Gestão D-1 do gerente.

### Checklist Diário

Endereço: `/checklist/:token`

Essa página permite que o responsável por um setor preencha o checklist diário de qualidade. A tela apresenta todos os itens do template configurado pelo administrador. Para cada item, o responsável marca se está conforme ou não conforme, pode adicionar observações e tirar fotos de evidência diretamente pela câmera do celular. Ao finalizar, o sistema calcula a nota de conformidade e envia os dados para o dashboard do portal.

### Correção de Checklist

Endereço: `/checklist-corrections/:id/:token`

Quando um item do checklist diário é marcado como não conforme, o responsável pode receber um link para registrar a correção. Nessa página, ele descreve a ação corretiva tomada, tira uma foto comprovando a correção e envia. A correção fica vinculada ao item original, criando um histórico completo de problema e solução.

---

## Considerações Finais

O Portal da Liderança do Grupo Caju é uma ferramenta viva, que evolui constantemente para atender às necessidades da operação. Ele integra controle financeiro, gestão de pessoas, qualidade operacional e inteligência de dados em uma única plataforma, acessível de qualquer dispositivo.

O objetivo final é simples: dar aos líderes as informações certas, no momento certo, para que possam tomar decisões melhores e mais rápidas. E, com isso, garantir que cada cliente que entra em um restaurante do Grupo Caju tenha a melhor experiência possível.
