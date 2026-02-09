import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Download, FileText } from "lucide-react";
import type { SalesImportResult, ParseFailure } from "@/hooks/useDailySales";

interface CMVImportSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: SalesImportResult;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function generateErrorLog(failures: ParseFailure[], dbErrors: ParseFailure[]): string {
  const lines: string[] = [];
  lines.push("=== LOG DE ERROS DA IMPORTAÇÃO ===");
  lines.push(`Data/Hora: ${new Date().toLocaleString("pt-BR")}`);
  lines.push("");

  if (failures.length > 0) {
    lines.push(`--- FALHAS DE PARSING (${failures.length}) ---`);
    for (const f of failures) {
      lines.push(`Linha ${f.line}: ${f.reason}`);
      lines.push(`  Dados: ${f.rawData}`);
    }
    lines.push("");
  }

  if (dbErrors.length > 0) {
    lines.push(`--- ERROS DE BANCO DE DADOS (${dbErrors.length}) ---`);
    for (const e of dbErrors) {
      lines.push(`${e.reason}`);
      lines.push(`  Dados: ${e.rawData}`);
    }
  }

  return lines.join("\n");
}

function downloadErrorLog(failures: ParseFailure[], dbErrors: ParseFailure[]) {
  const content = generateErrorLog(failures, dbErrors);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `erros-importacao-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CMVImportSummaryModal({ open, onOpenChange, result }: CMVImportSummaryModalProps) {
  const totalErrors = result.failures.length + result.dbErrors.length;
  const successCount = result.inserted + result.updated;
  const hasErrors = totalErrors > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
            Relatório de Importação
          </DialogTitle>
          <DialogDescription>
            {result.dateRange.start
              ? `Período: ${formatDateBR(result.dateRange.start)} a ${formatDateBR(result.dateRange.end)}`
              : "Nenhum registro processado"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Total no Arquivo"
              value={result.totalFileLines}
              icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              label="Processados c/ Sucesso"
              value={successCount}
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Inseridos" value={result.inserted} />
            <MiniStat label="Atualizados" value={result.updated} />
            <MiniStat
              label="Falhas"
              value={totalErrors}
              variant={totalErrors > 0 ? "destructive" : "default"}
            />
          </div>

          {result.failures.length > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
              <p className="font-medium text-foreground mb-1">Falhas de Parsing ({result.failures.length}):</p>
              {result.failures.slice(0, 10).map((f, i) => (
                <p key={i}>Linha {f.line}: {f.reason} — {f.rawData}</p>
              ))}
              {result.failures.length > 10 && (
                <p className="italic">...e mais {result.failures.length - 10} falhas. Baixe o log completo.</p>
              )}
            </div>
          )}

          {result.dbErrors.length > 0 && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
              <p className="font-medium mb-1">Erros de Banco ({result.dbErrors.length}):</p>
              {result.dbErrors.slice(0, 5).map((e, i) => (
                <p key={i}>{e.reason} — {e.rawData}</p>
              ))}
              {result.dbErrors.length > 5 && (
                <p className="italic">...e mais {result.dbErrors.length - 5} erros.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {hasErrors && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadErrorLog(result.failures, result.dbErrors)}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Baixar Log de Erros
            </Button>
          )}
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      {icon}
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "destructive";
}) {
  return (
    <div className="text-center rounded-lg border p-2">
      <p className={`text-lg font-bold ${variant === "destructive" && value > 0 ? "text-destructive" : ""}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
