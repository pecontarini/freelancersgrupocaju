

## Plano: PDF Completo no WhatsApp + Melhorias no Template Manager

### 1. PDF completo para envio por WhatsApp

Ao finalizar o checklist, o chefe tera dois botoes na tela de sucesso:
- **"Baixar PDF do Resultado"** -- gera e baixa o PDF no dispositivo
- **"Enviar PDF por WhatsApp"** -- gera o PDF, baixa, e abre o WhatsApp com mensagem resumida orientando a enviar o arquivo

O PDF seguira o mesmo padrao visual institucional (Grupo Caju) ja usado nos outros PDFs do sistema, incluindo:
- Logo e cabecalho institucional
- Titulo: "Checklist Diario - [Setor] - [Unidade]"
- Data, nome de quem aplicou
- Nota do dia em destaque
- Tabela com todos os itens: numero, texto do item, resposta (Conforme/Nao Conforme), observacao
- Rodape com data de geracao e paginacao

> Nota tecnica: Como o WhatsApp Web/Mobile nao permite enviar arquivos via URL `wa.me`, o fluxo sera: gerar PDF -> baixar automaticamente -> abrir WhatsApp com mensagem de texto resumida pedindo para anexar o PDF baixado.

### 2. Melhor usabilidade no Template Manager

Atualmente o campo "Nome do Template" so aparece depois de fazer upload do PDF. A melhoria:
- Mostrar o campo **"Nome do Template"** ANTES do upload, sempre visivel
- O admin pode digitar o nome primeiro e depois fazer upload
- Ao fazer upload, se o nome estiver vazio, auto-preenche com `[Loja] - [nome do arquivo]`
- Se ja tiver um nome digitado, mantem o nome do usuario

### Detalhes Tecnicos

**Arquivo: `src/pages/DailyChecklist.tsx`**
- Importar `jsPDF` e `jspdf-autotable`
- Criar funcao `generateChecklistPDF(result)` que monta o PDF com:
  - Logo base64, cabecalho institucional (cores do `PDF_COLORS`)
  - Secao de resumo: nota, conformes/nao conformes
  - Tabela com `autoTable`: colunas #, Item, Resultado, Observacao
  - Itens nao conformes destacados em vermelho
  - Rodape com data e paginacao
- Botao "Baixar PDF" chama `generateChecklistPDF` e salva com `doc.save()`
- Botao "Enviar por WhatsApp" chama `generateChecklistPDF`, salva, e abre `wa.me` com mensagem resumida

**Arquivo: `src/components/checklist-daily/ChecklistTemplateManager.tsx`**
- Mover o campo "Nome do Template" para FORA do bloco `{items.length > 0 && ...}`, exibindo-o sempre abaixo do campo de upload
- No `handleFileUpload`, so auto-preencher o nome se `templateName` estiver vazio

### Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/DailyChecklist.tsx` | Adicionar geracao de PDF com jsPDF + botoes de download e WhatsApp |
| `src/components/checklist-daily/ChecklistTemplateManager.tsx` | Mover campo "Nome do Template" para antes do upload |

