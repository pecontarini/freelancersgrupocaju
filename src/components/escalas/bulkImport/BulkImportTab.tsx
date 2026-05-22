import { useMemo, useRef, useState } from "react";
import { Download, Upload, Loader2, FileSpreadsheet, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAccessibleStores } from "@/hooks/useAccessibleStores";
import { toast } from "sonner";
import { toLocalISODate } from "./lib/weekUtils";
import {
  downloadTemplateWorkbook,
  parseFilledWorkbook,
  type ImportSlot,
  type ParsePreviewRow,
  type TemplateRow,
} from "./lib/xlsxTemplate";
import { UnitWeekControls } from "./UnitWeekControls";
import { ImportResultCard, type ImportResult } from "./ImportResultCard";
import { ImportHistoryModal } from "./ImportHistoryModal";

export interface BulkImportTabProps {
  unitId?: string | null;
  onDone?: () => void;
  showUnitSelector?: boolean;
}

export function BulkImportTab({
  unitId: unitIdProp,
  onDone: _onDone,
  showUnitSelector = true,
}: BulkImportTabProps) {
  const { stores } = useAccessibleStores();
  const [internalUnitId, setInternalUnitId] = useState<string | null>(unitIdProp ?? null);
  const unitId = showUnitSelector ? internalUnitId : unitIdProp ?? null;

  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [parsedSlots, setParsedSlots] = useState<ImportSlot[] | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsePreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<{ rowIndex: number; motivo: string }[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [result, setResult] = useState<ImportResult | null>(null);
  const [resultFileName, setResultFileName] = useState<string>("");
  const [resultImportedAt, setResultImportedAt] = useState<Date>(new Date());
  const [employeeNameMap, setEmployeeNameMap] = useState<Record<string, string>>({});

  const [historyOpen, setHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unidadeNome = useMemo(
    () => stores.find((s) => s.id === unitId)?.nome ?? "UNIDADE",
    [stores, unitId],
  );

  const canDownload = !!unitId && !!weekStart && !downloading;

  const handleDownload = async () => {
    if (!unitId || !weekStart) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.rpc("get_bulk_import_template_data", {
        p_unit_id: unitId,
      });

      if (error) {
        toast.error("Sem acesso a essa unidade ou erro no servidor");
        return;
      }
      if (!data || data.length === 0) {
        toast.warning("Nenhum funcionário ativo encontrado nesta unidade");
        return;
      }

      const rows = data as TemplateRow[];
      // Cache name map for future error reporting
      const map: Record<string, string> = {};
      rows.forEach((r) => (map[r.employee_id] = r.nome));
      setEmployeeNameMap((prev) => ({ ...prev, ...map }));

      downloadTemplateWorkbook(rows, weekStart, unidadeNome);
      toast.success(`Modelo gerado com ${rows.length} funcionários`);
    } catch (e: any) {
      toast.error(`Falha ao gerar modelo: ${e.message ?? e}`);
    } finally {
      setDownloading(false);
    }
  };

  const resetUpload = () => {
    setParsedSlots(null);
    setPreviewRows([]);
    setParseErrors([]);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!weekStart) {
      toast.error("Selecione a semana de referência antes de importar");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    try {
      const parsed = await parseFilledWorkbook(file, weekStart);
      if (parsed.slots.length === 0 && parsed.parseErrors.length === 0) {
        toast.error("Nenhum slot preenchido no arquivo");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setParsedSlots(parsed.slots);
      setPreviewRows(parsed.previewRows);
      setParseErrors(parsed.parseErrors);
      setPendingFile(file);
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao ler o arquivo");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = async () => {
    if (!unitId || !weekStart || !parsedSlots || !pendingFile) return;
    if (parsedSlots.length === 0) {
      toast.error("Nenhum slot preenchido no arquivo");
      return;
    }
    setImporting(true);
    try {
      const { data, error } = await supabase.rpc("import_schedule_slots", {
        p_unit_id: unitId,
        p_week_start_date: toLocalISODate(weekStart),
        p_payload: parsedSlots as any,
        p_arquivo_nome: pendingFile.name,
      });

      if (error) {
        toast.error(`Erro na importação: ${error.message}`);
        return;
      }

      const res = data as unknown as ImportResult;
      setResult(res);
      setResultFileName(pendingFile.name);
      setResultImportedAt(new Date());

      if (res.status === "sucesso") {
        toast.success(`${res.total_sucesso} escalas importadas com sucesso`);
      } else if (res.status === "parcial") {
        toast.warning(`${res.total_sucesso} sucessos · ${res.total_erro} erros`);
      } else {
        toast.error(`Importação falhou. ${res.total_erro} erros.`);
      }
      resetUpload();
    } catch (e: any) {
      toast.error(`Falha: ${e.message ?? e}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Importar Escala Semanal</h3>
        <p className="text-sm text-muted-foreground">
          Importe a escala da semana via planilha pré-populada por unidade.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Modelo pré-populado por unidade.</strong> Você só preenche os horários. O ID
          de cada funcionário já vem na planilha — não altere as colunas Nome, CPF, Cargo ou
          Setor.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <UnitWeekControls
            unitId={unitId}
            onUnitChange={setInternalUnitId}
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            showUnitSelector={showUnitSelector}
          />

          <Button
            onClick={handleDownload}
            disabled={!canDownload}
            className="w-full sm:w-auto"
            aria-label="Baixar modelo desta unidade"
          >
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Baixar Modelo desta Unidade
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-semibold">Enviar planilha preenchida</h4>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileSelected}
            aria-label="Selecionar arquivo XLSX preenchido"
          />

          {!parsedSlots ? (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!unitId || !weekStart}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar Escala Preenchida
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{pendingFile?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {parsedSlots.length} slot(s) · {previewRows.length} funcionário(s)
                      {parseErrors.length > 0 && ` · ${parseErrors.length} aviso(s)`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetUpload}
                    aria-label="Cancelar upload"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {previewRows.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Linha</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Dias preenchidos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.slice(0, 5).map((r) => (
                        <TableRow key={r.rowIndex}>
                          <TableCell>{r.rowIndex}</TableCell>
                          <TableCell>{r.nome || r.employee_id}</TableCell>
                          <TableCell className="text-right">{r.diasPreenchidos}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {previewRows.length > 5 && (
                    <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                      … e mais {previewRows.length - 5} funcionário(s)
                    </div>
                  )}
                </div>
              )}

              {parseErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <div className="font-medium">
                      {parseErrors.length} aviso(s) detectado(s) na leitura:
                    </div>
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {parseErrors.slice(0, 5).map((e, i) => (
                        <li key={i}>
                          Linha {e.rowIndex}: {e.motivo}
                        </li>
                      ))}
                      {parseErrors.length > 5 && (
                        <li>… e mais {parseErrors.length - 5}</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleConfirmImport}
                disabled={importing || parsedSlots.length === 0}
                className="w-full sm:w-auto"
              >
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Importação ({parsedSlots.length} slot
                {parsedSlots.length !== 1 ? "s" : ""})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <ImportResultCard
          result={result}
          fileName={resultFileName}
          importedAt={resultImportedAt}
          employeeNameMap={employeeNameMap}
          onOpenHistory={() => setHistoryOpen(true)}
        />
      )}

      {!result && unitId && (
        <div className="text-center">
          <Button variant="link" size="sm" onClick={() => setHistoryOpen(true)}>
            Ver histórico de importações desta unidade
          </Button>
        </div>
      )}

      <ImportHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        unitId={unitId}
      />
    </div>
  );
}
