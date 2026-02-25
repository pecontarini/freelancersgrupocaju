

## Plano: Gerar Documento Markdown para NotebookLM

### Objetivo

Criar o arquivo `docs/app-guide-notebooklm.md` com um texto completo, em linguagem natural e em portugues, descrevendo todas as telas, perfis de acesso e fluxos do Portal da Lideranca do Grupo Caju. O arquivo pode ser baixado e usado como fonte no NotebookLM para gerar audio ou video.

### Implementacao

| Arquivo | Acao |
|---------|------|
| `docs/app-guide-notebooklm.md` | Criar arquivo Markdown com o guia completo |

### Conteudo do Documento

O documento tera aproximadamente 12 secoes:

1. **Introducao e Visao Geral** — O que e o Portal da Lideranca, para que serve, quais marcas fazem parte (Caju Limao, Caminito Parrilla, Nazo Japanese, Foster's Burguer)

2. **Perfis de Acesso** — Descricao detalhada dos 5 perfis:
   - Admin (acesso total)
   - Socio Operador (lojas vinculadas, pode editar budgets)
   - Gerente de Unidade (operacional das lojas vinculadas)
   - Chefe de Setor (apenas aba Escalas)
   - Colaborador (confirmacao de turno via link externo)

3. **Tela de Login** — Fluxo de entrada, cadastro com aprovacao do admin

4. **Aba Budgets Gerenciais** — Cards de resumo financeiro, barra de consumo diario, lancamentos (freelancer, despesas, manutencao), filtros, graficos, exportacao PDF, botao "Editar Budgets" com verificacao de senha

5. **Aba Remuneracao Variavel** — Simulador de bonus, tiers, ranking entre lojas, feed de alertas, lancamento semanal

6. **Aba Diagnostico de Auditoria** — Upload de checklists, KPIs, graficos de evolucao, ranking de recorrencias, relatorios PDF, analise com IA, sub-aba de Checklist Diario

7. **Aba Performance Lideranca** — Diagnostico hierarquico por responsavel

8. **Aba CMV (Unitarios)** — Contagem de estoque, NF-e, vendas, Kardex, auditoria de periodo, fechamento, mapeamento de produtos, cadastro de itens

9. **Aba Escalas** — Editor semanal, Gestao D-1, Quadro Operacional, Equipe, Cargos e Setores, Configuracoes de matriz

10. **Aba Dores da Operacao (Admin)** — Central de reclamacoes, upload com IA, Pareto, diagnostico por loja, planos de acao

11. **Aba Configuracoes (Admin)** — Orcamento por loja, cargos, bonus, Google Sheets, checklists, lojas/funcoes/gerencias, usuarios

12. **Aba Visao Rede (Admin)** — Dashboard executivo, KPIs globais, rankings, matriz de severidade, lead time

13. **Paginas Externas** — Confirmacao de turno (`/confirm-shift`), Checklist diario (`/checklist`), Correcao de checklist (`/checklist-corrections`)

### Estilo de Escrita

- Portugues brasileiro, linguagem natural e descritiva
- Tom de narrador explicando cada tela como se estivesse mostrando o app
- Sem codigo, sem jargao tecnico
- Ideal para o NotebookLM interpretar e gerar audio/video

### Resultado

Um unico arquivo `.md` pronto para download e upload no NotebookLM.

