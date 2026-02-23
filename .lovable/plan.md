
## Plano: Exportacao Executiva da Escala Geral (Excel + PDF)

### Objetivo

Elevar a exportacao da Escala Geral para nivel de entrega ao diretor, com dois formatos profissionais.

---

### 1. Excel Executivo (.xlsx)

Reformular `src/lib/scheduleMasterExport.ts` para gerar um arquivo visualmente organizado:

**Por aba (setor):**
- Linha 1: Cabecalho mesclado com nome do setor, unidade e periodo (merge cells)
- Linha 3: Header dos dias com fundo vermelho institucional (#D05937), texto branco, negrito
- Funcionarios CLT em linhas alternadas (branco/cinza claro) para facilitar leitura
- Linha separadora "EXTRAS" com fundo laranja claro antes dos freelancers
- Freelancers com fundo laranja suave para diferenciar visualmente
- Celulas de FOLGA com fundo cinza escuro e texto branco
- Celulas de FERIAS com fundo roxo claro
- Celulas de horario com texto centralizado
- Linha "RESUMO DO DIA" com fundo amarelo claro e negrito
- Linhas POP com fundo cinza claro e labels em negrito
- Coluna de nomes com largura 32, colunas de dias com largura 22
- Bordas finas em todas as celulas de dados

**Nota tecnica:** A lib `xlsx` (SheetJS community/open-source) NAO suporta estilos de celula (cores, negrito, bordas). Para contornar isso, vamos trocar para a lib `xlsx-js-style`, que e um fork compativel que adiciona suporte completo a estilos. Alternativa: como o projeto ja usa `xlsx`, vamos maximizar a organizacao via estrutura (merges, larguras, linhas separadoras claras) e gerar o arquivo mais limpo possivel com a lib atual.

**Aba extra "Resumo Geral":**
- Tabela consolidada: Setor | Seg | Ter | ... | Dom (com contagens Efetivos/Extras/Total)
- Totais gerais na ultima linha

### 2. PDF Institucional (.pdf) -- Novo arquivo

Criar `src/lib/scheduleMasterPdf.ts` usando jsPDF + autoTable, reutilizando o tema de `grupoCajuPdfTheme.ts`:

**Pagina 1 -- Capa:**
- Logo Grupo Caju centralizado
- Titulo: "Escala Operacional Semanal"
- Unidade e Periodo
- Data de emissao
- Linha institucional vermelha

**Paginas seguintes -- Uma por setor:**
- Mini-header com logo pequeno + nome do setor
- Tabela com jspdf-autotable:
  - Header vermelho institucional com texto branco
  - Colunas: Funcionario | Seg (dd/MM) | Ter | ... | Dom
  - Celulas FOLGA em cinza, FERIAS em roxo, horarios normais em branco
  - Freelancers com nome em laranja e tag [EXTRA]
  - Linhas alternadas para legibilidade
- Bloco de resumo abaixo: Efetivos / Extras / Total por dia
- Bloco POP por turno

**Rodape em todas as paginas:**
- Data de geracao | "Grupo Caju - Escala Operacional" | Pagina X/Y

### 3. Botao com Dropdown

Converter `src/components/escalas/MasterExportButton.tsx` de botao unico para dropdown com:
- "Baixar Excel (.xlsx)" -- chama exportMasterSchedule
- "Baixar PDF (.pdf)" -- chama exportMasterSchedulePdf

---

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/lib/scheduleMasterExport.ts` | Refatorar: adicionar merges no cabecalho, aba "Resumo Geral", linhas separadoras mais claras, larguras otimizadas |
| `src/lib/scheduleMasterPdf.ts` | **Novo**: PDF institucional com capa + tabelas por setor + resumo + POP + rodape |
| `src/components/escalas/MasterExportButton.tsx` | Converter para dropdown com opcoes Excel e PDF |

### Dados utilizados

Ambos os formatos puxam exatamente os mesmos dados:
- `sectors` -- setores da unidade
- `schedules` -- escalas da semana
- `employees` -- funcionarios ativos (nome, tipo CLT/extra)
- `staffing_matrix` -- POP efetivo minimo (required_count + extras_count por setor/dia/turno)
- `shifts` -- tipos de turno (almoco, jantar, etc.)

A logica de fetch sera extraida para uma funcao compartilhada `fetchScheduleData()` para evitar duplicacao entre Excel e PDF.
