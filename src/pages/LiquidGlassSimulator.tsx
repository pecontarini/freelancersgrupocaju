import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { LiquidBackground } from "@/components/liquid-glass/LiquidBackground";
import { SceneNavigator, type SceneId } from "@/components/liquid-glass/SceneNavigator";
import { LoginScene } from "@/components/liquid-glass/scenes/LoginScene";
import { DashboardScene } from "@/components/liquid-glass/scenes/DashboardScene";
import { NotificationsScene } from "@/components/liquid-glass/scenes/NotificationsScene";
import { ModalScene } from "@/components/liquid-glass/scenes/ModalScene";
import { BottomSheetScene } from "@/components/liquid-glass/scenes/BottomSheetScene";

const sceneComponents: Record<SceneId, React.FC> = {
  login: LoginScene,
  dashboard: DashboardScene,
  notifications: NotificationsScene,
  modal: ModalScene,
  bottomsheet: BottomSheetScene,
};

export default function LiquidGlassSimulator() {
  const [scene, setScene] = useState<SceneId>("login");
  const Scene = sceneComponents[scene];

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans" style={{ background: "#0a0a1a" }}>
      <LiquidBackground />
      <div className="relative z-30 pb-24 pt-8">
        <AnimatePresence mode="wait">
          <Scene key={scene} />
        </AnimatePresence>
      </div>
      <SceneNavigator active={scene} onChange={setScene} />
    </div>
  );
}
