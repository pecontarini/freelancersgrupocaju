

## Plano: Redesign Profissional dos PDFs (Checklist Diario + Relatorio NC)

### Diagnostico dos problemas atuais

Ambos os PDFs sofrem dos mesmos problemas de design:

1. **Layout comprimido** -- elementos colados uns nos outros sem respiro visual
2. **Hierarquia tipografica fraca** -- tamanhos de fonte muito similares entre titulos e corpo
3. **Capa inexistente** -- o conteudo comeca direto no topo, sem presenca institucional forte
4. **Secao de fotos basica** -- grid simples sem moldura, label e observacao mal posicionados
5. **Link de correcao (NC)** -- caixa generica sem destaque visual suficiente
6. **Sem Termo de Ciencia** -- falta formalidade no fechamento

---

### Mudancas propostas

#### 1. PDF do Checklist Diario (`src/pages/DailyChecklist.tsx`)

**Pagina 1 -- Capa Executiva Institucional**
- Logo centralizado no topo com linha institucional vermelha
- Titulo "Checklist Diario" em destaque
- Bloco de dados: Setor, Unidade, Aplicado Por, Data, Template
- Indicadores grandes: NOTA (com cor por faixa), CONFORMES, NAO CONFORMES
- Linha institucional no rodape da capa

**Pagina 2+ -- Tabela de Resultados**
- Header de continuacao com mini-logo e nome da secao
- Tabela com linhas zebradas (alternando branco/cinza claro)
- Coluna de status com icones visuais (circulo verde/vermelho) em vez de texto puro

**Secao de Evidencias Fotograficas (redesenhada)**
- Cada foto dentro de um card com:
  - Borda arredondada cinza sutil
  - Numero sequencial no canto (badge vermelho)
  - Titulo do item abaixo da foto em negrito
  - Observacao em italico com fundo cinza claro
- Layout em grid 2 colunas com espacamento uniforme
- Separador institucional antes da secao

**Rodape padronizado** em todas as paginas (ja implementado via `addPageFooter`)

#### 2. PDF do Relatorio NC (`ChecklistResponsesDashboard.tsx`)

**Pagina 1 -- Capa Institucional NC**
- Reutilizar o padrao de capa do theme (`addExecutiveCover` adaptado)
- Titulo: "Relatorio de Nao Conformidades"
- Subtitulo: Setor e Unidade
- Indicadores: Total de NCs e Nota do Checklist
- Data de emissao e aplicador

**Pagina 2 -- Tabela de NCs**
- Header de continuacao com mini-logo
- Tabela com colunas: #, Item, Peso, Observacao, Status
- Status estilizado: "Pendente" com fundo vermelho claro, "Corrigido" com fundo verde claro
- Linhas zebradas

**Secao de Link de Correcao (redesenhada)**
- Caixa grande com borda institucional espessa (2px)
- Icone de clipboard estilizado (desenhado com formas geometricas)
- Titulo "Registrar Correcoes" em tamanho maior
- Instrucao clara em corpo de texto
- URL em destaque com underline e cor institucional
- Espaco para QR code placeholder (instrucao para escanear)

**Pagina final -- Termo de Ciencia**
- Reutilizar `addSignaturePage` do theme existente
- Formaliza o documento com espaco para assinatura

---

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/pdf/grupoCajuPdfTheme.ts` | Adicionar helpers: `addChecklistCover()`, `addPhotoEvidenceCard()`, `addCorrectionLinkSection()` |
| `src/pages/DailyChecklist.tsx` | Refatorar `generateChecklistPDF` para usar capa, cards de foto redesenhados e rodape |
| `src/components/checklist-daily/ChecklistResponsesDashboard.tsx` | Refatorar `generateNCReport` para usar capa, tabela zebrada, link redesenhado e termo de ciencia |

### Novos helpers no theme

```text
addChecklistCover(doc, params)
  - Capa especifica para checklists (diferente da capa de auditoria)
  - Params: sectorName, unitName, appliedBy, date, score, conforming, nonConforming, templateName

addPhotoEvidenceCard(doc, params)
  - Card individual de evidencia fotografica com moldura
  - Params: x, y, w, h, imageUrl, itemText, observation, index

addCorrectionLinkBox(doc, y, url)
  - Caixa de destaque para o link de correcao
  - Visual premium com borda espessa e instrucoes claras
```

### Principios de design aplicados

- **Respiro visual**: Margens generosas (20mm) e espacamento entre secoes (12-16mm)
- **Hierarquia clara**: Titulos 16-22pt, subtitulos 12pt, corpo 9-10pt, labels 8pt
- **Cor com proposito**: Vermelho institucional apenas em titulos e indicadores; cinzas para fundo e bordas
- **Consistencia**: Ambos os PDFs seguem o mesmo design system (`grupoCajuPdfTheme`)
- **Formalidade**: Termo de ciencia no fechamento para compliance

