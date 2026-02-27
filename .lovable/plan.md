
# Experiencia Interativa de Auditorias

## Objetivo
Transformar a visualizacao de auditorias em uma experiencia rica e interativa. Ao clicar no numero de auditorias (KPI card) ou em qualquer auditoria no historico, abrir um painel detalhado com a nota, o PDF original, e uma galeria de fotos de evidencia com navegacao fluida.

## O que muda

### 1. KPI Card "Auditorias" se torna clicavel
O card que mostra o total de auditorias realizadas passa a ser um botao. Ao clicar, abre um Dialog full-screen listando todas as auditorias do periodo, organizadas por data, com nota e tipo de checklist.

### 2. Novo componente: AuditDetailViewer
Um Dialog/Drawer rico que substitui o Sheet atual do historico. Ele tera:

- **Cabecalho**: Unidade, data formatada, tipo de checklist e nota em destaque com cor contextual
- **Secao PDF**: Se a auditoria possui `pdf_url`, exibe um iframe embutido para visualizar o PDF diretamente no app, com botao para abrir em nova aba
- **Secao Falhas**: Lista de nao conformidades com layout de cards, incluindo detalhes e status (pendente/corrigido/validado)
- **Galeria de Fotos**: As fotos de evidencia (`url_foto_evidencia`) e fotos de resolucao (`resolution_photo_url`) sao exibidas em cards com preview clicavel que abre um lightbox/modal de zoom
- **Navegacao entre auditorias**: Botoes "Anterior" e "Proxima" para navegar entre auditorias sem fechar o painel

### 3. Novo componente: AuditListDialog
Dialog que abre ao clicar no KPI card. Lista as auditorias em cards compactos com nota, unidade e data. Clicar em qualquer card abre o AuditDetailViewer.

### 4. Galeria de fotos com lightbox
Componente simples de lightbox para ampliar imagens de evidencia. Clicando na miniatura, a foto abre em overlay full-screen com botao de fechar.

## Detalhes Tecnicos

### Arquivos novos
- `src/components/audit-diagnostic/AuditDetailViewer.tsx` — Dialog principal com tabs (PDF | Falhas | Fotos)
- `src/components/audit-diagnostic/AuditListDialog.tsx` — Lista clicavel de auditorias (abre do KPI)
- `src/components/audit-diagnostic/PhotoLightbox.tsx` — Lightbox para ampliar fotos

### Arquivos editados
- `src/components/audit-diagnostic/AuditKPICards.tsx` — Card "Auditorias" recebe onClick
- `src/components/audit-diagnostic/AuditHistoryTable.tsx` — Substituir Sheet por AuditDetailViewer
- `src/components/dashboard/AuditDiagnosticDashboard.tsx` — Gerenciar estado do AuditListDialog e passar callbacks
- `src/components/audit-diagnostic/index.ts` — Exportar novos componentes

### Estrutura do AuditDetailViewer
```text
+-----------------------------------------------+
|  [<] Anterior    Auditoria     Proxima [>]     |
+-----------------------------------------------+
|  CAMINITO ASS  |  26/02/2026  |  86.2%         |
|  Supervisao de Front                           |
+-----------------------------------------------+
|  [ PDF ]  [ Falhas (4) ]  [ Fotos (3) ]       |
+-----------------------------------------------+
|                                                 |
|  Tab PDF: iframe do PDF ou "sem PDF"           |
|  Tab Falhas: cards com status + detalhes       |
|  Tab Fotos: grid de miniaturas clicaveis       |
|                                                 |
+-----------------------------------------------+
```

### Dados utilizados
- `supervision_audits.pdf_url` — URL do PDF original
- `supervision_failures.url_foto_evidencia` — Fotos de evidencia da nao conformidade
- `supervision_failures.resolution_photo_url` — Fotos de correcao
- `supervision_failures.detalhes_falha` — Detalhes textuais

### Sem alteracoes no banco de dados
Todos os dados necessarios ja existem nas tabelas `supervision_audits` e `supervision_failures`.
