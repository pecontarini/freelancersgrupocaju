export function LiquidBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#0a0a1a" }}>
      {/* Orbs */}
      <div
        className="absolute rounded-full"
        style={{
          width: 600, height: 600, top: "-10%", left: "-5%",
          background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)",
          animation: "orbDrift1 16s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 500, height: 500, top: "20%", right: "-8%",
          background: "radial-gradient(circle, rgba(96,165,250,0.45) 0%, transparent 70%)",
          animation: "orbDrift2 20s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 450, height: 450, bottom: "5%", left: "20%",
          background: "radial-gradient(circle, rgba(244,114,182,0.4) 0%, transparent 70%)",
          animation: "orbDrift3 14s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 350, height: 350, bottom: "25%", right: "25%",
          background: "radial-gradient(circle, rgba(52,211,153,0.35) 0%, transparent 70%)",
          animation: "orbDrift4 18s ease-in-out infinite alternate",
        }}
      />
      {/* Noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      <style>{`
        @keyframes orbDrift1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(80px, 60px) scale(1.15); }
        }
        @keyframes orbDrift2 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-60px, 80px) scale(1.1); }
        }
        @keyframes orbDrift3 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(50px, -50px) scale(1.2); }
        }
        @keyframes orbDrift4 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-40px, -60px) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
