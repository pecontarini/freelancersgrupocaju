## Objetivo
Nenhum PDF/Excel gerado por um usuário Stutz pode conter a palavra "CajuPAR"/"Grupo Caju" ou a logo do Caju. Mesmo para outros tenants (2Sell, futuros), o output deve refletir a marca correta. Caju continua vendo Caju.

## Diagnóstico
Achei referências hardcoded em:

**PDFs (usam `LOGO_BASE64` = logo Caju e strings "CAJUPAR"/"CajuPAR"):**
- `src/lib/logoBase64.ts` — logo Caju embutida em base64
- `src/lib/pdf/grupoCajuPdfTheme.ts` — footer "Documento de uso interno • CajuPAR", "CajuPAR • Auditoria Operacional", "sistema de gestão de qualidade do CajuPAR"
- `src/lib/pdf/checklistPdfHelpers.ts` — footer "Documento de uso interno • CajuPAR"
- `src/lib/pdf/pdfImageUtils.ts` — comentário/uso
- `src/lib/scheduleMasterPdf.ts` — "CajuPAR — Escala Operacional", "Documento de uso interno • CajuPAR"
- `src/lib/scheduleDailyControlPdf.ts` — "CajuPAR — Folha de Controle de Intervalos"
- `src/components/ExportReportButton.tsx` — header PDF "CAJUPAR - {loja}"
- `src/components/MaintenanceExportButton.tsx` — header "CAJUPAR - {loja}" + footer "Sistema CajuPAR"
- `src/components/MaintenanceSingleExportButton.tsx` — footer "Sistema CajuPAR"

**Templates WhatsApp / edge functions (fora do escopo desta rodada, mas listados para transparência):** `messageTemplates.ts`, `generate-magic-pix-link`, prompts de IA. Estes rodam server-side ou são strings de negócio Caju-específicas — mantidos como estão salvo pedido explícito.

## Estratégia

### 1. Novo helper de branding para exports (`src/lib/pdf/exportBranding.ts`)
- Função `getExportBranding()` que lê `document.documentElement.getAttribute("data-tenant")` (já setado pelo `TenantContext`) e retorna:
  - `name`: nome curto para header ("STUTZ", "CAJUPAR", "2SELL")
  - `fullName`: nome longo para footer ("Stutz", "Grupo CajuPAR", "2Sell")
  - `logoDataUrl`: base64 pronto para jsPDF (Caju continua usando `LOGO_BASE64` atual; Stutz usa novo asset base64; fallback = null → não desenha logo)
  - `footerLine`: "Documento de uso interno • {fullName}"
- Registry interno por slug. `caju` → dados atuais. `stutz` → nome Stutz + logo Stutz. Fallback (outros tenants) → usa `appName` do registry + sem logo (ou logo default 2Sell).

### 2. Logo Stutz em base64
- Converter `user-uploads://stutz_s-tagline4.png` (versão preta, funciona em fundo branco do PDF) para base64 e salvar em `src/lib/brandLogos/stutzLogoBase64.ts`.
- Manter `src/lib/logoBase64.ts` (Caju) inalterado — apenas deixa de ser importada diretamente.

### 3. Refatorar cada arquivo de export
Substituir imports diretos de `LOGO_BASE64` e strings hardcoded por chamada a `getExportBranding()`:

- `grupoCajuPdfTheme.ts`, `checklistPdfHelpers.ts`, `pdfImageUtils.ts`, `scheduleMasterPdf.ts`, `scheduleDailyControlPdf.ts`:
  - Trocar `LOGO_BASE64` por `branding.logoDataUrl` (skip `addImage` se null).
  - Trocar literais "CajuPAR"/"CAJUPAR" por `branding.fullName` / `branding.name`.
- `ExportReportButton.tsx`, `MaintenanceExportButton.tsx`, `MaintenanceSingleExportButton.tsx`:
  - Chamar `getExportBranding()` no início do handler; usar em header/footer.
  - Comentário "Brand colors (CajuPAR)" atualizado para "Brand colors (tenant)".

Nota: os arquivos PDF do `pdf/` são módulos puros (sem hooks). Ler o tenant via `document.documentElement.dataset.tenant` é seguro porque a geração de PDF sempre parte de uma ação do usuário no browser, com o `TenantContext` já montado (o próprio `applyThemeToDocument` seta esse atributo).

### 4. Validação
- Build (typecheck automático).
- Visual: gerar 1 PDF autenticado como Stutz e conferir header/footer/logo — nenhuma menção a Caju.
- Regressão Caju: gerar mesmo PDF autenticado como Caju — continua idêntico ao atual.

## Fora de escopo (avisar o usuário)
- Templates de WhatsApp/PIX em `messageTemplates.ts` e edge functions (`generate-magic-pix-link`, `send-shift-reminders`, prompts de IA `plano-acao-ia`, `agenda-lider-chat`, `cmv-ai-assistant`, `analyze-audit-patterns`, `pop-wizard-chat`) — hoje são específicos Caju. Se quiser tornar multi-tenant também, é um segundo bloco (precisa ler `tenant_id` no server e escolher template).
- URLs `freelancersgrupocaju.lovable.app` em edge functions — Caju-específicas, fora deste escopo de "output visual".

Confirma esse recorte (PDFs + Excel do frontend agora, WhatsApp/edge functions depois)?