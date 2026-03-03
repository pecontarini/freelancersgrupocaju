export function AppGlassBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Orb 1 — coral/primary top-left */}
      <div
        className="absolute -top-[15%] -left-[10%] h-[55%] w-[55%] rounded-full opacity-[0.07] dark:opacity-[0.18] blur-[120px]"
        style={{ background: "hsl(14, 70%, 48%)" }}
      />
      {/* Orb 2 — blue-tinted bottom-right */}
      <div
        className="absolute -bottom-[15%] -right-[10%] h-[45%] w-[45%] rounded-full opacity-[0.05] dark:opacity-[0.14] blur-[100px]"
        style={{ background: "hsl(220, 60%, 55%)" }}
      />
      {/* Orb 3 — subtle warm center */}
      <div
        className="absolute top-[40%] left-[50%] h-[35%] w-[35%] -translate-x-1/2 rounded-full opacity-[0.04] dark:opacity-[0.10] blur-[90px]"
        style={{ background: "hsl(8, 75%, 42%)" }}
      />
    </div>
  );
}
