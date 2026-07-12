# Rebrand global: Caju → 2Sell (paleta preto/branco)

Objetivo: eliminar a logo do Caju e os tons de laranja/coral de **todas** as áreas do app (plataforma e painéis de tenants) e usar sempre a logo da **2Sell**, com estética neutra P&B.

## 1. Upload das logos 2Sell (Lovable Assets)

Duas variantes já enviadas pelo usuário:
- `Logo-2ELL-IA-Consulting-1-2_png-2.png` (preta sobre branco) → **2sell-logo-light.png** (usada no tema light)
- `Logo-2ELL-IA-Consulting-1-_png-2.png` (branca sobre preto) → **2sell-logo-dark.png** (usada no tema dark)

Também gerar/derivar um **símbolo** (a letra "2" isolada) como `2sell-symbol.png` para splash/favicon; se não for viável recortar, usar a logo completa mesmo.

## 2. Ponto único de verdade da marca

Criar `src/lib/brand.ts` exportando as URLs das logos 2Sell + helper `useBrandLogo()` que devolve light/dark conforme o tema atual (`next-themes` → `resolvedTheme`).

Todo componente que hoje importa `@/assets/logo.png`, `cajuparLogoLight`, `cajuparLogoDark` ou usa `tenant.logos.*` para exibir marca passa a usar esse helper. **A logo do tenant não é mais renderizada** — a marca fixa é 2Sell em todo o app.

## 3. Componentes a ajustar

| Área | Arquivo | Mudança |
|---|---|---|
| Login | `src/pages/Auth.tsx` | Remove lógica `is2board`/`tenant.logos` → sempre 2Sell por tema |
| Reset senha | `src/pages/ResetPassword.tsx` | Substitui `cajuparLogo` por 2Sell |
| Confirmar turno | `src/pages/ConfirmShift.tsx` | idem |
| Checklist diário | `src/pages/DailyChecklist.tsx` | idem |
| Correções checklist | `src/pages/ChecklistCorrections.tsx` | idem |
| Sidebar | `src/components/layout/AppSidebar.tsx` | Remove fallbacks Caju, ignora `tenant.logos`, usa 2Sell |
| Bottom nav mobile | `src/components/layout/BottomNavigation.tsx` | idem |
| Header portal | `src/components/layout/PortalHeader.tsx` | verificar/atualizar se exibir logo |
| App header | `src/components/AppHeader.tsx` | idem |
| Splash carregando | `src/components/motion/BrandSplash.tsx` | Usa símbolo 2Sell + glow neutro (branco/cinza) |
| Aurora background | `src/components/motion/AuroraBackground.tsx` | Orbs coral/âmbar → tons grafite/branco translúcido |
| App background | `src/components/ui/cj-app-background.tsx` | Neutraliza gradientes coral |
| Tela sem acesso | `src/components/TenantNoAccessScreen.tsx` | Logo 2Sell |
| Admin tenants | `src/pages/admin/Tenants.tsx` | Marca 2Sell no cabeçalho |
| PDFs (relatórios, escala, checklist, manutenção) | `src/lib/pdf/*`, `src/lib/scheduleMasterPdf.ts`, `src/lib/scheduleDailyControlPdf.ts`, `src/components/MaintenanceExportButton.tsx`, `MaintenanceSingleExportButton.tsx`, `ExportReportButton.tsx` | Trocar `LOGO_BASE64` / tema Caju por asset 2Sell e paleta P&B |
| Logo base64 | `src/lib/logoBase64.ts` | Regenerar como 2Sell (base64 para PDFs) |
| Tema PDF | `src/lib/pdf/grupoCajuPdfTheme.ts` | Cores viram preto/cinza; renomear ficará como refactor futuro |

## 4. Tokens de cor e CSS

- **`src/index.css`**: remover/neutralizar `--primary`, `--accent`, `--cj-accent-strong` que hoje são coral. Ficam em escalas de cinza (ex.: `--primary: 0 0% 10%` no light, `0 0% 95%` no dark). `--ring`, `--sidebar-primary` etc. seguem o mesmo caminho.
- **`src/styles/cajupar-glass.css`**: `--cj-orange` e `--cj-orange-light` viram tons neutros (grafite/branco).
- **`src/styles/cajupar-design-system.css`**: qualquer coral hardcoded → neutro.
- **`tailwind.config.ts`**: revisar tokens custom que referenciam coral.
- **Tenants no banco**: o `TenantContext` deixa de aplicar `theme.primary`/`primaryStrong`/`accent` vindos do DB (ou aplicamos sempre a paleta 2Sell, ignorando o que vier). Preserva `data-tenant` só para segmentação, sem impacto visual.

## 5. Splash / Aurora neutros

- `AuroraBackground`: 4 orbs em `hsl(0 0% 100% / 0.08–0.15)` sobre base `hsl(0 0% 4%)` (dark) e cinza claro (light). Sem coral/âmbar.
- `BrandSplash`: halo do logo em `hsl(0 0% 100% / 0.25)`, shimmer branco, drop-shadow neutro. Texto "Carregando seu portal…" mantém.

## 6. `index.html` e favicon

- `<title>` e `<meta description>`: "2Sell — …" (já está 2board; ajustar para 2Sell).
- Favicon: apontar para símbolo 2Sell (asset novo).
- Remover qualquer referência remanescente a Caju/coral em meta tags/theme-color.

## 7. Tenants no banco (branding)

Não é preciso migração destrutiva. O `TenantContext` passa a **ignorar** `logo_url`, `logo_dark_url`, `logo_symbol_url`, `theme.primary` etc. no que diz respeito à renderização — mantém `slug`, `id`, `copy.appName` (nome da empresa aparece como texto, ex.: no seletor de tenants) e resolução de acesso. Nada muda no schema.

## 8. Validação

- Playwright headless em `/auth`, `/` (após login mock), `/admin/tenants`, `/reset-password`, `/checklist-diario`, tela de erro sem acesso. Screenshots em light e dark para confirmar ausência total de coral e presença da 2Sell.
- Grep final por `cajupar`, `caju`, `#D05937`, `#E05C1A`, `orange`, `coral`, `terracotta` em `src/` — remanescentes só em comentários/nomes de classes utilitárias já reescritas.

## Detalhes técnicos

- `useBrandLogo()` retorna `{ full: string; symbol: string; alt: string }` com base em `resolvedTheme`.
- PDFs: converter novo PNG 2Sell para base64 (script único) e atualizar `logoBase64.ts`.
- Nomes de arquivos/classes com prefixo `cajupar-`/`cj-` são mantidos para minimizar churn — só o **conteúdo** (cores/valores) é neutralizado. Renomeações ficam como tech debt em `TECH_DEBT.md`.
- Nenhuma alteração de rota, RLS, edge function ou schema.
