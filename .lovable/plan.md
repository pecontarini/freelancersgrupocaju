
# Plano — Estilo de animação MoneyMQ no Portal CajuPAR

Aplicar a linguagem cinematográfica da referência (aurora difusa, reveals suaves com máscaras, easing longo e elegante, logo "respirando") nas **transições entre rotas** e na **tela de carregamento** do app, preservando a paleta Coral/Terracotta da marca.

## O que será criado

### 1. Splash / tela de carregamento cinemática
Novo componente `src/components/motion/BrandSplash.tsx`:
- Fundo escuro com gradiente aurora animado (em vez do verde MoneyMQ, usaremos Coral #D05937 + tons quentes da marca) — orbes radiais com `blur(120px)` em drift lento (12–20s).
- Logo CajuPAR centralizado com:
  - Entrada por **clip-path reveal** (do centro para fora) + leve scale 0.96 → 1.
  - Animação contínua de "respiração" (opacity 0.85 ↔ 1, scale 1 ↔ 1.02) em loop suave.
  - Glow sutil pulsando atrás do logo.
- Easing assinado: `cubic-bezier(0.65, 0, 0.35, 1)` (cinematic ease) com durações longas (700–1200ms).
- Substitui o `<Loader2 spinner>` atual em `ProtectedRoute.tsx` e em estados de loading principais (Auth, Index inicial).

### 2. Page transition wrapper
Novo `src/components/motion/PageTransition.tsx` + integração no `App.tsx`:
- Envolve `<Routes>` e dispara animação ao trocar `location.pathname`.
- Animação dupla:
  - **Saída** da rota anterior: fade + leve translate up (-8px) + scale 0.99, 280ms.
  - **Entrada** da nova rota: clip-path reveal (de uma "fita" horizontal abrindo) + fade-in + translateY(8→0), 480ms.
- Implementação CSS-only com chaves de animação no Tailwind (sem adicionar Framer Motion, para manter bundle leve). Usa `key={location.pathname}` para remount controlado.

### 3. Aurora background reutilizável
Novo `src/components/motion/AuroraBackground.tsx`:
- Versão refinada do `AppGlassBackground` atual, com 4 orbes em coral/âmbar/terracota, drift mais lento e mais blur — usado por `BrandSplash` e disponível para telas-chave (Auth, Splash inicial).

### 4. Micro-transições de UI
Adicionar utilitários no Tailwind / `index.css`:
- `.animate-clip-reveal` — clip-path inset de 100% → 0 com easing cinematográfico.
- `.animate-breathe` — loop suave de scale/opacity para elementos em destaque.
- `.animate-aurora-drift` — drift lento dos orbes (já parcial em `LiquidBackground`, será padronizado).
- Padrão de transição em `Card`, `Button` e `Tabs` usando o easing assinado, para que toda a UI "fale a mesma língua".

## Arquivos a criar
- `src/components/motion/BrandSplash.tsx`
- `src/components/motion/PageTransition.tsx`
- `src/components/motion/AuroraBackground.tsx`
- `src/components/motion/index.ts`

## Arquivos a editar
- `src/App.tsx` — envolver `<Routes>` com `<PageTransition>`.
- `src/components/ProtectedRoute.tsx` — trocar spinner pelo `<BrandSplash />`.
- `src/index.css` — adicionar keyframes (`clip-reveal`, `breathe`, `aurora-drift`, `route-enter`, `route-exit`) e variável `--ease-cinematic`.
- `tailwind.config.ts` — registrar as novas animações e o easing.
- `src/pages/Auth.tsx` — usar `AuroraBackground` no fundo (opcional, melhora primeira impressão).

## Detalhes técnicos
- Sem novas dependências (sem Framer Motion). CSS + React keys.
- Respeita `prefers-reduced-motion`: animações longas degradam para fade simples de 150ms.
- `BrandSplash` aceita `variant="full" | "inline"` para servir tanto como splash de página inteira quanto como loader em painéis.
- Logo do splash usa `src/lib/logoBase64.ts` (já existente) para evitar flash de carregamento de asset.
- Page transition exclui rotas públicas sensíveis a performance (`/checkin`, `/estacao-checkin`, `/checklist/*`) — nelas usamos apenas fade rápido.

## Diagrama de fluxo

```text
Boot do app
   │
   ▼
AuthProvider carregando ──► <BrandSplash variant="full" />  (aurora + logo respirando)
   │
   ▼ user pronto
<PageTransition>
   ├─ saída: fade + translate-up + scale-down  (280ms)
   └─ entrada: clip-reveal + fade + translate-up (480ms, ease cinematográfico)
   │
   ▼
Conteúdo da rota
```

## Fora do escopo (pode virar fase 2)
- Animações orbitais/morphing do logo (a referência usa After Effects).
- Transições compartilhadas entre elementos (shared-element) — exigiriam Framer Motion.
- Loader específico por módulo (CMV, Escalas) — manteremos os atuais por enquanto.

Posso prosseguir com a implementação?
