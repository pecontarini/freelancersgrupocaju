import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Printer, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { SupervisionAudit, SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { categorizeItemToSector, SECTOR_POSITION_MAP, type AuditSector } from "@/lib/sectorPositionMapping";
import logoUrl from "@/assets/grupo-caju-logo.png";

interface AuditReportGeneratorProps {
  audits: SupervisionAudit[];
  failures: SupervisionFailure[];
  unitName: string;
  periodLabel: string;
  avgScore: number | null;
}

interface SectorSummary {
  name: string;
  lostPoints: number;
}

interface RecurrenceItem {
  itemName: string;
  sector: string;
  count: number;
}

export function AuditReportGenerator({
  audits,
  failures,
  unitName,
  periodLabel,
  avgScore,
}: AuditReportGeneratorProps) {
  const [open, setOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Compute recurrences
  const recurrences: RecurrenceItem[] = (() => {
    const counts: Record<string, { count: number; sector: string }> = {};
    failures.forEach((f) => {
      if (!counts[f.item_name]) {
        const sector = categorizeItemToSector(f.item_name, f.category);
        counts[f.item_name] = { count: 0, sector: SECTOR_POSITION_MAP[sector]?.displayName || sector };
      }
      counts[f.item_name].count++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v.count >= 2)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([name, v]) => ({ itemName: name, sector: v.sector, count: v.count }));
  })();

  // Sector summary
  const sectorSummary: SectorSummary[] = (() => {
    const counts: Record<string, number> = {};
    failures.forEach((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      const name = SECTOR_POSITION_MAP[sector]?.displayName || sector;
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, lostPoints]) => ({ name, lostPoints }));
  })();

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
          <head>
            <title>Relatório de Auditoria - ${unitName}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; padding: 24px; }
              .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #D05937; }
              .logo { height: 48px; }
              .header-info { text-align: right; }
              .header-info h1 { font-size: 18px; text-transform: uppercase; color: #D05937; }
              .header-info p { font-size: 12px; color: #666; }
              .score-box { text-align: center; padding: 20px; margin: 16px 0; border: 2px solid #D05937; border-radius: 12px; }
              .score-box .value { font-size: 48px; font-weight: bold; }
              .score-green { color: #16a34a; }
              .score-yellow { color: #d97706; }
              .score-red { color: #dc2626; }
              h2 { font-size: 14px; text-transform: uppercase; color: #D05937; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
              th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 2px solid #e5e5e5; }
              td { padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
              .recurring { background: #fef2f2; color: #dc2626; font-weight: bold; }
              .signature { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e5e5; }
              .signature-line { margin-top: 48px; border-top: 1px solid #333; width: 280px; padding-top: 4px; font-size: 11px; color: #666; }
              .action-box { margin-top: 24px; border: 1px dashed #ccc; border-radius: 8px; padding: 16px; min-height: 100px; }
              .action-box p { font-size: 11px; color: #999; }
              @media print { body { padding: 16px; } }
            </style>
          </head>
          <body>
            ${printRef.current.innerHTML}
          </body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      }
    }
  };

  const scoreColorClass =
    avgScore === null ? "" : avgScore >= 90 ? "score-green" : avgScore >= 80 ? "score-yellow" : "score-red";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Gerar Relatório</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Relatório para a Liderança
            </DialogTitle>
            <Button onClick={handlePrint} size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Printable content */}
        <div ref={printRef}>
          {/* Header */}
          <div className="header">
            <img src={logoUrl} alt="Logo" className="logo" />
            <div className="header-info">
              <h1>Relatório de Auditoria</h1>
              <p>{unitName}</p>
              <p>{periodLabel}</p>
            </div>
          </div>

          {/* Score box */}
          <div className="score-box">
            <p style={{ fontSize: "11px", color: "#666", textTransform: "uppercase" }}>Nota Média do Período</p>
            <p className={`value ${scoreColorClass}`}>
              {avgScore !== null ? `${avgScore.toFixed(1)}%` : "—"}
            </p>
            <p style={{ fontSize: "11px", color: "#666" }}>
              {audits.length} auditoria(s) realizada(s)
            </p>
          </div>

          {/* Recurrences */}
          <h2>🔥 Foco de Melhoria (Recorrências)</h2>
          {recurrences.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#666", padding: "12px 0" }}>
              Nenhuma recorrência detectada no período. ✅
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Setor</th>
                  <th style={{ textAlign: "center" }}>Vezes</th>
                </tr>
              </thead>
              <tbody>
                {recurrences.map((r) => (
                  <tr key={r.itemName} className="recurring">
                    <td>{r.itemName}</td>
                    <td>{r.sector}</td>
                    <td style={{ textAlign: "center" }}>{r.count}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Sector Summary */}
          <h2>📊 Resumo Setorial</h2>
          <table>
            <thead>
              <tr>
                <th>Setor</th>
                <th style={{ textAlign: "center" }}>Falhas</th>
              </tr>
            </thead>
            <tbody>
              {sectorSummary.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td style={{ textAlign: "center" }}>{s.lostPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Action Plan space */}
          <div className="signature">
            <h2>📝 Plano de Ação do Chefe / Gerente</h2>
            <div className="action-box">
              <p>Escreva aqui as ações corretivas prioritárias para o período:</p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "48px" }}>
              <div className="signature-line">Assinatura do Chefe / Gerente</div>
              <div className="signature-line">Assinatura do Diretor</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
