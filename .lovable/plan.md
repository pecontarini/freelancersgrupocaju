

# Plano: Rebranding Grupo Caju → CajuPAR

## Resumo

Substituir toda a identidade visual "Grupo Caju" pela nova marca "CajuPAR" em todo o sistema: logos, textos, metadados, PDFs e favicons.

## Assets Recebidos

| Imagem | Uso |
|--------|-----|
| `Logo_principal_preta_PNG.png` | Sidebar (tema claro), Auth, PDFs |
| `Logo_principal_branca_PNG.png` | Sidebar (tema escuro), mobile header dark |
| `Simbolo_PNG.png` | Favicon, sidebar colapsada, ícone mobile |
| `Simbolo_branco_monocromatico_PNG.png` | Ícone em fundos escuros |
| `Simbolo_preto_monocromatico_PNG.png` | Ícone em fundos claros |
| `Logo_principal_branca_monocromatica_PNG.png` | PDFs (fundo escuro), rodapés |
| `Logo_principal_preta_monocromatica_PNG.png` | PDFs (fundo claro) |

## Alterações

### 1. Copiar assets para o projeto
- Copiar logos para `src/assets/cajupar-logo-dark.png` (logo preta, para fundo claro) e `src/assets/cajupar-logo-light.png` (logo branca, para fundo escuro)
- Copiar símbolo colorido para `src/assets/cajupar-symbol.png`
- Copiar símbolo preto para `public/favicon-cajupar.png` e gerar favicon

### 2. Sidebar (`src/components/layout/AppSidebar.tsx`)
- Trocar import de `grupo-caju-logo.png` por logos CajuPAR
- Usar logo escura no tema claro, logo branca no tema escuro (via `useTheme`)
- Sidebar colapsada: mostrar símbolo CajuPAR em vez da letra "C"
- Atualizar alt text e subtítulo "Portal da Liderança" mantido

### 3. Bottom Navigation (`src/components/layout/BottomNavigation.tsx`)
- Trocar logo no header mobile pelo símbolo/logo CajuPAR
- Theme-aware: logo escura em fundo claro, branca em fundo escuro

### 4. Auth + Reset Password (`src/pages/Auth.tsx`, `src/pages/ResetPassword.tsx`)
- Trocar logo para CajuPAR
- Atualizar alt text de "Grupo Caju" para "CajuPAR"

### 5. Confirm Shift (`src/pages/ConfirmShift.tsx`)
- Trocar logo e alt text

### 6. Daily Checklist + Checklist Corrections (`src/pages/DailyChecklist.tsx`, `src/pages/ChecklistCorrections.tsx`)
- Trocar import de logo

### 7. PDF Generators (6 arquivos)
- `src/lib/pdf/grupoCajuPdfTheme.ts` — Atualizar textos "Grupo Caju" para "CajuPAR", atualizar `LOGO_BASE64` com novo logo
- `src/lib/scheduleMasterPdf.ts` — Trocar referências textuais
- `src/components/ExportReportButton.tsx` — Trocar título "GRUPO CAJU"
- `src/components/MaintenanceExportButton.tsx` — Trocar referências
- `src/components/audit-diagnostic/AuditReportGenerator.tsx` — Trocar logo import
- `src/lib/logoBase64.ts` — Regenerar base64 com o novo logo CajuPAR

### 8. Edge Function (`supabase/functions/analyze-audit-patterns/index.ts`)
- Trocar "Grupo Caju" no prompt do sistema por "CajuPAR"

### 9. Metadados (`index.html`)
- Title: "CajuPAR - Portal da Liderança"
- Atualizar og:title, og:description, meta author, etc.

### 10. Busca global por referências remanescentes
- Varrer todos os arquivos por "Grupo Caju" e "grupo-caju" para garantir cobertura completa

## Arquivos Impactados

| Arquivo | Ação |
|---------|------|
| `src/assets/` | Adicionar 3+ novos assets CajuPAR |
| `public/` | Novo favicon |
| `index.html` | Atualizar metadados |
| `src/components/layout/AppSidebar.tsx` | Logo + tema |
| `src/components/layout/BottomNavigation.tsx` | Logo mobile |
| `src/pages/Auth.tsx` | Logo login |
| `src/pages/ResetPassword.tsx` | Logo reset |
| `src/pages/ConfirmShift.tsx` | Logo |
| `src/pages/DailyChecklist.tsx` | Logo |
| `src/pages/ChecklistCorrections.tsx` | Logo |
| `src/lib/logoBase64.ts` | Novo base64 |
| `src/lib/pdf/grupoCajuPdfTheme.ts` | Textos PDF |
| `src/lib/scheduleMasterPdf.ts` | Textos PDF |
| `src/components/ExportReportButton.tsx` | Textos PDF |
| `src/components/MaintenanceExportButton.tsx` | Textos PDF |
| `src/components/audit-diagnostic/AuditReportGenerator.tsx` | Logo PDF |
| `supabase/functions/analyze-audit-patterns/index.ts` | Prompt AI |

