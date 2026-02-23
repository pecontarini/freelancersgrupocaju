import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportMasterSchedule } from "@/lib/scheduleMasterExport";
import { exportMasterSchedulePdf } from "@/lib/scheduleMasterPdf";

interface MasterExportButtonProps {
  unitId: string;
  unitName: string;
  weekStart: Date;
}

export function MasterExportButton({ unitId, unitName, weekStart }: MasterExportButtonProps) {
  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);

  async function handleExport(type: "excel" | "pdf") {
    setLoading(type);
    try {
      if (type === "excel") {
        await exportMasterSchedule({ unitId, unitName, weekStart });
        toast.success("Excel da Escala Geral exportado!");
      } else {
        await exportMasterSchedulePdf({ unitId, unitName, weekStart });
        toast.success("PDF da Escala Geral exportado!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao exportar escala.");
    } finally {
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-amber-500/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {loading === "excel" ? "Gerando Excel..." : loading === "pdf" ? "Gerando PDF..." : "Exportar Escala"}
          </span>
          <span className="sm:hidden">Geral</span>
          {!isLoading && <ChevronDown className="h-3 w-3 opacity-60" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem onClick={() => handleExport("excel")} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Baixar Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-red-600" />
          Baixar PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
