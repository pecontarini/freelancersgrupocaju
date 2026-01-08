import { Download } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { exportToExcel } from "@/lib/excelUtils";
import { FreelancerEntry } from "@/types/freelancer";

interface ExportReportButtonProps {
  entries: FreelancerEntry[];
}

export function ExportReportButton({ entries }: ExportReportButtonProps) {
  const handleExport = () => {
    if (entries.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }

    const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm");
    const filename = `relatorio_pagamentos_${timestamp}`;

    try {
      exportToExcel(entries, filename);
      toast.success(`Relatório exportado com ${entries.length} registros.`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar relatório.");
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} className="gap-2">
      <Download className="h-4 w-4" />
      Exportar Relatório
    </Button>
  );
}
