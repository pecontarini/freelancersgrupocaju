import { LiquidBackground } from "@/components/liquid-glass/LiquidBackground";
import { FloatingNav } from "@/components/liquid-glass/FloatingNav";
import { HeroCard } from "@/components/liquid-glass/HeroCard";
import { SidebarPanel } from "@/components/liquid-glass/SidebarPanel";
import { NotificationToast } from "@/components/liquid-glass/NotificationToast";
import { FloatingDock } from "@/components/liquid-glass/FloatingDock";

export default function LiquidGlassDemo() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans" style={{ background: "#0a0a1a" }}>
      <LiquidBackground />
      <FloatingNav />
      <SidebarPanel />

      {/* Hero centered */}
      <div className="relative z-30 flex min-h-screen items-center justify-center">
        <HeroCard />
      </div>

      <NotificationToast />
      <FloatingDock />
    </div>
  );
}
