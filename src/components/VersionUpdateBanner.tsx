import { useVersionCheck } from "@/hooks/useVersionCheck";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function VersionUpdateBanner() {
  const { updateAvailable, currentBuildId, reloadNow } = useVersionCheck();

  return (
    <>
      {updateAvailable && (
        <div
          role="alert"
          className="fixed top-3 left-1/2 z-[9999] -translate-x-1/2 flex items-center gap-3 rounded-full border border-border/40 bg-background/80 px-4 py-2 shadow-lg backdrop-blur-md"
          style={{ WebkitBackdropFilter: "blur(12px)" }}
        >
          <RefreshCw className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            Nova versão disponível
          </span>
          <Button size="sm" onClick={reloadNow} className="h-7 px-3 text-xs">
            Atualizar agora
          </Button>
        </div>
      )}
      <div
        aria-hidden
        className="fixed bottom-1 right-2 z-[9998] pointer-events-none select-none text-[10px] font-mono text-muted-foreground/40"
      >
        v{String(currentBuildId).slice(-6)}
      </div>
    </>
  );
}
