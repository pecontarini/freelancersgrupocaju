import { cn } from "@/lib/utils";
import { AuroraBackground } from "./AuroraBackground";
import { BRAND_LOGO_DARK, BRAND_NAME } from "@/lib/brand";

interface BrandSplashProps {
  /** "full" = full-screen splash, "inline" = fits its container. */
  variant?: "full" | "inline";
  /** Optional caption shown below the mark. */
  message?: string;
  className?: string;
}

/**
 * Splash cinematográfico neutro — aurora escura com a marca 2Sell "respirando".
 * Sempre em fundo escuro, então usamos a logo variante dark (branca).
 */
export function BrandSplash({
  variant = "full",
  message,
  className,
}: BrandSplashProps) {
  const isFull = variant === "full";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        isFull ? "fixed inset-0 z-[100]" : "min-h-[280px] w-full rounded-3xl",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message ?? "Carregando"}
    >
      <AuroraBackground dark className={isFull ? undefined : "absolute"} />

      {/* Center stack */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* Halo neutro atrás da marca */}
        <div className="relative">
          <div
            className="absolute inset-0 -z-10 rounded-full"
            style={{
              background:
                "radial-gradient(circle, hsl(0 0% 100% / 0.25) 0%, transparent 70%)",
              filter: "blur(40px)",
              transform: "scale(2.2)",
              animation: "splash-glow 4s ease-in-out infinite",
            }}
          />
          <div
            className="splash-reveal"
            style={{
              animation:
                "splash-reveal 1100ms cubic-bezier(0.65, 0, 0.35, 1) both, splash-breathe 4.2s ease-in-out 1100ms infinite",
            }}
          >
            <img
              src={BRAND_LOGO_DARK}
              alt={BRAND_NAME}
              className={cn(
                "select-none object-contain drop-shadow-[0_8px_32px_rgba(255,255,255,0.15)]",
                isFull ? "h-24 md:h-32 w-auto" : "h-16 w-auto"
              )}
              draggable={false}
            />
          </div>
        </div>

        {/* Caption */}
        {message && (
          <p
            className="text-sm font-medium tracking-wide text-white/70"
            style={{
              animation:
                "splash-fade-up 900ms cubic-bezier(0.65, 0, 0.35, 1) 350ms both",
            }}
          >
            {message}
          </p>
        )}

        {/* Shimmer neutro */}
        <div
          className="mt-2 h-[2px] w-40 overflow-hidden rounded-full bg-white/10"
          style={{
            animation:
              "splash-fade-up 900ms cubic-bezier(0.65, 0, 0.35, 1) 500ms both",
          }}
        >
          <div
            className="h-full w-1/3 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.8), transparent)",
              animation: "splash-shimmer 1.6s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}
