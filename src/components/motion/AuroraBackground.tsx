import { cn } from "@/lib/utils";

interface AuroraBackgroundProps {
  /** Quando true, pinta uma base escura atrás dos orbs (usado no splash). */
  dark?: boolean;
  className?: string;
}

/**
 * Fundo aurora neutro — orbs em tons de branco/cinza que derivam lentamente.
 * Sem cores de destaque: se alinha à identidade 2Sell (P&B).
 */
export function AuroraBackground({ dark = false, className }: AuroraBackgroundProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      {dark && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(0 0% 8%) 0%, hsl(0 0% 4%) 70%, hsl(0 0% 2%) 100%)",
          }}
        />
      )}

      {/* Orb 1 — branco suave */}
      <div
        className="absolute rounded-full will-change-transform"
        style={{
          width: "60vmax",
          height: "60vmax",
          top: "-20%",
          left: "-15%",
          background:
            "radial-gradient(circle, hsl(0 0% 100% / 0.14) 0%, transparent 65%)",
          filter: "blur(120px)",
          animation: "aurora-drift-1 22s ease-in-out infinite alternate",
          opacity: dark ? 0.9 : 0.35,
        }}
      />

      {/* Orb 2 — cinza claro */}
      <div
        className="absolute rounded-full will-change-transform"
        style={{
          width: "50vmax",
          height: "50vmax",
          top: "10%",
          right: "-15%",
          background:
            "radial-gradient(circle, hsl(0 0% 100% / 0.10) 0%, transparent 65%)",
          filter: "blur(110px)",
          animation: "aurora-drift-2 26s ease-in-out infinite alternate",
          opacity: dark ? 0.85 : 0.3,
        }}
      />

      {/* Orb 3 — grafite */}
      <div
        className="absolute rounded-full will-change-transform"
        style={{
          width: "55vmax",
          height: "55vmax",
          bottom: "-20%",
          left: "20%",
          background:
            "radial-gradient(circle, hsl(0 0% 100% / 0.08) 0%, transparent 65%)",
          filter: "blur(130px)",
          animation: "aurora-drift-3 28s ease-in-out infinite alternate",
          opacity: dark ? 0.85 : 0.28,
        }}
      />

      {/* Orb 4 — highlight sutil */}
      <div
        className="absolute rounded-full will-change-transform"
        style={{
          width: "35vmax",
          height: "35vmax",
          bottom: "10%",
          right: "10%",
          background:
            "radial-gradient(circle, hsl(0 0% 100% / 0.12) 0%, transparent 65%)",
          filter: "blur(90px)",
          animation: "aurora-drift-4 20s ease-in-out infinite alternate",
          opacity: dark ? 0.7 : 0.22,
        }}
      />

      {/* Grão sutil */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "180px 180px",
        }}
      />
    </div>
  );
}
