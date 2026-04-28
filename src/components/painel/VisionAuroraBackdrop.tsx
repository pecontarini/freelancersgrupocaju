/**
 * Aurora backdrop scoped to the Painel de Indicadores.
 * Absolute-positioned within its parent (the Painel root must be `relative`).
 */
export function VisionAuroraBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* Coral primary */}
      <div
        className="absolute rounded-full"
        style={{
          width: "55vmax",
          height: "55vmax",
          top: "-15%",
          left: "-10%",
          background:
            "radial-gradient(circle, hsl(14 80% 55% / 0.18) 0%, transparent 65%)",
          filter: "blur(110px)",
          animation: "aurora-drift-1 24s ease-in-out infinite alternate",
        }}
      />
      {/* Amber */}
      <div
        className="absolute rounded-full"
        style={{
          width: "45vmax",
          height: "45vmax",
          top: "10%",
          right: "-12%",
          background:
            "radial-gradient(circle, hsl(28 90% 60% / 0.14) 0%, transparent 65%)",
          filter: "blur(100px)",
          animation: "aurora-drift-2 28s ease-in-out infinite alternate",
        }}
      />
      {/* Cool blue (Vision-style) */}
      <div
        className="absolute rounded-full"
        style={{
          width: "50vmax",
          height: "50vmax",
          bottom: "-15%",
          left: "20%",
          background:
            "radial-gradient(circle, hsl(210 70% 55% / 0.12) 0%, transparent 65%)",
          filter: "blur(120px)",
          animation: "aurora-drift-3 30s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}
