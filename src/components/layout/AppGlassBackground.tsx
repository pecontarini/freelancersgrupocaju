export function AppGlassBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Orb 1 — grafite top-left (identidade 2Sell P&B) */}
      <div
        className="absolute -top-[15%] -left-[10%] h-[55%] w-[55%] rounded-full opacity-[0.08] dark:opacity-[0.20] blur-[120px]"
        style={{ background: "hsl(0, 0%, 12%)" }}
      />
      {/* Orb 2 — cinza médio bottom-right */}
      <div
        className="absolute -bottom-[15%] -right-[10%] h-[45%] w-[45%] rounded-full opacity-[0.06] dark:opacity-[0.16] blur-[100px]"
        style={{ background: "hsl(0, 0%, 35%)" }}
      />
      {/* Orb 3 — highlight neutro central */}
      <div
        className="absolute top-[40%] left-[50%] h-[35%] w-[35%] -translate-x-1/2 rounded-full opacity-[0.04] dark:opacity-[0.10] blur-[90px]"
        style={{ background: "hsl(0, 0%, 60%)" }}
      />
    </div>
  );
}
