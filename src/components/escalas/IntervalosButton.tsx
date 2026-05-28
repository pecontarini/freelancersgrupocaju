import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Coffee } from "lucide-react";
import { IntervalosDrawer } from "./IntervalosDrawer";

interface Props {
  unitId: string;
  unitName: string;
}

export function IntervalosButton({ unitId, unitName }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-xs border-amber-500/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
      >
        <Coffee className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Intervalos do dia</span>
        <span className="sm:hidden">Interv.</span>
      </Button>

      {open && (
        <IntervalosDrawer
          open={open}
          onOpenChange={setOpen}
          unitId={unitId}
          unitName={unitName}
        />
      )}
    </>
  );
}
