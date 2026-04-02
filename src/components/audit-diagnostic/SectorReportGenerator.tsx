import { useState, useMemo } from "react";
import { FileBarChart, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import type { SupervisionFailure } from "@/hooks/useSupervisionAudits";
import {
  categorizeItemToSector,
  SECTOR_POSITION_MAP,
  POSITION_LABELS,
  type AuditSector,
} from "@/lib/sectorPositionMapping";
import {
  PDF_COLORS,
  PDF_LAYOUT,
  addContinuationHeader,
} from "@/lib/pdf/grupoCajuPdfTheme";
import { LOGO_BASE64 } from "@/lib/logoBase64";

interface SectorReportGeneratorProps {
  failures: SupervisionFailure[];
  unitName: string;
  periodLabel: string;
}

interface SectorGroup {
  sector: AuditSector;
  displayName: string;
  chiefLabel: string;
  failures: SupervisionFailure[];
  recurringCount: number;
}

function groupFailuresBySector(failures: SupervisionFailure[]): SectorGroup[] {
  const groups: Record<AuditSector, SupervisionFailure[]> = {} as any;

  failures.forEach((f) => {
    const sector = categorizeItemToSector(f.item_name, f.category);
    if (!groups[sector]) groups[sector] = [];
    groups[sector].push(f);
  });

  return Object.entries(groups)
    .map(([sector, sectorFailures]) => {
      const config = SECTOR_POSITION_MAP[sector as AuditSector];
      const chiefLabel = config.primaryChief
        ? POSITION_LABELS[config.primaryChief]
        : POSITION_LABELS[config.responsibleManager];

      // Count recurring items (3+ occurrences)
      const itemCounts: Record<string, number> = {};
      sectorFailures.forEach((f) => {
        itemCounts[f.item_name] = (itemCounts[f.item_name] || 0) + 1;
      });
      const recurringCount = Object.values(itemCounts).filter((c) => c >= 3).length;

      return {
        sector: sector as AuditSector,
        displayName: config.displayName,
        chiefLabel,
        failures: sectorFailures,
        recurringCount,
      };
    })
    .sort((a, b) => b.failures.length - a.failures.length);
}

function generateSectorPDF(
  selectedGroups: SectorGroup[],
  unitName: string,
  periodLabel: string
) {
  const doc = new jsPDF("p", "mm", "a4");
  const margin = PDF_LAYOUT.margin;
  const pageWidth = doc.internal.pageSize.getWidth();

  selectedGroups.forEach((group, groupIndex) => {
    if (groupIndex > 0) doc.addPage();

    let y = margin;

    // Logo
    try {
      doc.addImage(LOGO_BASE64, "JPEG", margin, y - 5, 22, 15);
    } catch {}

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...PDF_COLORS.institutional);
    doc.text(`RELATÓRIO SETORIAL — ${group.displayName.toUpperCase()}`, margin + 28, y + 5);

    y += 16;
    doc.setDrawColor(...PDF_COLORS.institutional);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Meta info
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.gray600);
    doc.text(`Unidade: ${unitName}`, margin, y);
    doc.text(`Período: ${periodLabel}`, pageWidth / 2, y);
    y += 6;
    doc.text(`Responsável: ${group.chiefLabel}`, margin, y);
    y += 10;

    // Summary boxes
    const boxWidth = 55;
    const boxHeight = 22;

    // Apontamentos box
    doc.setFillColor(...PDF_COLORS.gray50);
    doc.setDrawColor(...PDF_COLORS.gray200);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text("APONTAMENTOS", margin + boxWidth / 2, y + 8, { align: "center" });
    doc.setFontSize(16);
    doc.setTextColor(...PDF_COLORS.institutional);
    doc.text(String(group.failures.length), margin + boxWidth / 2, y + 18, { align: "center" });

    // Recorrentes box
    doc.setFillColor(...PDF_COLORS.gray50);
    doc.roundedRect(margin + boxWidth + 8, y, boxWidth, boxHeight, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text("RECORRENTES", margin + boxWidth + 8 + boxWidth / 2, y + 8, { align: "center" });
    doc.setFontSize(16);
    doc.setTextColor(
      ...(group.recurringCount > 0 ? PDF_COLORS.danger : PDF_COLORS.success)
    );
    doc.text(String(group.recurringCount), margin + boxWidth + 8 + boxWidth / 2, y + 18, {
      align: "center",
    });

    y += boxHeight + 10;

    // Failures table
    const itemCounts: Record<string, number> = {};
    group.failures.forEach((f) => {
      itemCounts[f.item_name] = (itemCounts[f.item_name] || 0) + 1;
    });

    // Deduplicate failures for table display
    const uniqueFailures: { item_name: string; detalhes: string; count: number }[] = [];
    const seen = new Set<string>();
    group.failures.forEach((f) => {
      if (!seen.has(f.item_name)) {
        seen.add(f.item_name);
        uniqueFailures.push({
          item_name: f.item_name,
          detalhes: f.detalhes_falha || "—",
          count: itemCounts[f.item_name],
        });
      }
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", "Item", "Detalhes", "Recorrente?"]],
      body: uniqueFailures.map((f, i) => [
        String(i + 1),
        f.item_name,
        f.detalhes.length > 80 ? f.detalhes.substring(0, 77) + "..." : f.detalhes,
        f.count >= 3 ? `Sim (${f.count}×)` : "Não",
      ]),
      headStyles: {
        fillColor: PDF_COLORS.institutional,
        textColor: PDF_COLORS.white,
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: PDF_COLORS.graphite,
      },
      alternateRowStyles: {
        fillColor: PDF_COLORS.gray50,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 25, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const text = data.cell.raw as string;
          if (text.startsWith("Sim")) {
            data.cell.styles.textColor = PDF_COLORS.danger;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawPage: (data) => {
        // Footer
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...PDF_COLORS.gray400);
        doc.text(
          `Documento interno • CajuPAR • ${group.displayName}`,
          pageWidth / 2,
          pageH - 10,
          { align: "center" }
        );
        doc.text(
          `Página ${doc.getNumberOfPages()}`,
          pageWidth - margin,
          pageH - 10,
          { align: "right" }
        );
      },
    });
  });

  const fileName = `Relatorio_Setorial_${unitName.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

export function SectorReportGenerator({
  failures,
  unitName,
  periodLabel,
}: SectorReportGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [selectedSectors, setSelectedSectors] = useState<Set<AuditSector>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  const sectorGroups = useMemo(() => groupFailuresBySector(failures), [failures]);

  const toggleSector = (sector: AuditSector) => {
    setSelectedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSectors(new Set(sectorGroups.map((g) => g.sector)));
  };

  const clearAll = () => {
    setSelectedSectors(new Set());
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      const selected = sectorGroups.filter((g) => selectedSectors.has(g.sector));
      generateSectorPDF(selected, unitName, periodLabel);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileBarChart className="h-4 w-4" />
          <span className="hidden sm:inline">Por Setor</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileBarChart className="h-5 w-5 text-primary" />
            Relatório por Setor
          </DialogTitle>
        </DialogHeader>

        {sectorGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhuma falha registrada no período selecionado.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Selecione os setores para incluir no PDF:
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                  Todos
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7">
                  Limpar
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2 pr-2">
                {sectorGroups.map((group) => (
                  <label
                    key={group.sector}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedSectors.has(group.sector)}
                      onCheckedChange={() => toggleSector(group.sector)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{group.displayName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({group.chiefLabel})
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {group.failures.length} falha{group.failures.length !== 1 ? "s" : ""}
                    </Badge>
                  </label>
                ))}
              </div>
            </ScrollArea>

            <Button
              onClick={handleGenerate}
              disabled={selectedSectors.size === 0 || isGenerating}
              className="w-full gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileBarChart className="h-4 w-4" />
              )}
              Gerar PDF ({selectedSectors.size} setor{selectedSectors.size !== 1 ? "es" : ""})
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
