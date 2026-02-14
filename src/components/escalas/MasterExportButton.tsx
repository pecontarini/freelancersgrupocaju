import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportMasterSchedule } from "@/lib/scheduleMasterExport";

interface MasterExportButtonProps {
  unitId: string;
  unitName: string;
  weekStart: Date;
}

export function MasterExportButton({ unitId, unitName, weekStart }: MasterExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      await exportMasterSchedule({ unitId, unitName, weekStart });
      toast.success("Escala Geral exportada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao exportar escala.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs border-amber-500/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
      onClick={handleExport}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">Baixar Escala Geral (.xlsx)</span>
      <span className="sm:hidden">Geral</span>
    </Button>
  );
}
