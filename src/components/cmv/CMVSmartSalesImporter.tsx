import { useState, useRef, useMemo, useCallback } from "react";
import {
  Upload, FileSpreadsheet, Loader2, Trash2, ArrowRight, ArrowLeft,
  CheckCircle2, Columns3, CalendarDays, Eye, Zap, AlertTriangle,
  PackageCheck, PackageX, Link2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useDailySales, aggregateSales, ParsedSaleRow, SalesImportResult, ParseFailure } from "@/hooks/useDailySales";
import { CMVImportSummaryModal } from "./CMVImportSummaryModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";

// ─── Types ───────────────────────────────────────────────────────────
type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "excel_serial";

interface ColumnMapping {
  date: number;
  product: number;
  quantity: number;
  amount: number | null;
}

interface FileData {
  headers: string[];
  rows: unknown[][];
  fileName: string;
  totalRows: number;
}

type Step = "upload" | "mapping" | "dateformat" | "preview" | "done";

interface MatchedSaleItem extends ParsedSaleRow {
  ingredientName: string;
  multiplicador: number;
  consumo: number;
}

interface UnmatchedSaleItem {
  item_name: string;
  quantity: number;
}

// ─── Utilities ───────────────────────────────────────────────────────
function guessColumnRole(header: string): "date" | "product" | "quantity" | "amount" | null {
  const h = header.toLowerCase().replace(/[_\s]+/g, "");
  if (/dtcontabil|data|date|fecha|datahora|datetime/.test(h)) return "date";
  if (/materialdescr|descr|item|produto|product|nome|name|material/.test(h)) return "product";
  if (/qtd|quantidade|qty|quantity/.test(h)) return "quantity";
  if (/vltot|valortotal|total|amount|valor|revenue/.test(h)) return "amount";
  return null;
}

function detectDateFormat(sampleValues: unknown[]): DateFormat {
  for (const val of sampleValues) {
    if (typeof val === "number" && val > 25000 && val < 60000) return "excel_serial";
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return "YYYY-MM-DD";
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed)) {
        const parts = trimmed.split("/");
        const first = parseInt(parts[0], 10);
        // If first number > 12 it must be a day
        if (first > 12) return "DD/MM/YYYY";
        // Heuristic: check multiple samples
      }
    }
  }
  return "DD/MM/YYYY"; // Default for Brazilian context
}

function parseWithFormat(value: unknown, format: DateFormat): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && format === "excel_serial") {
    if (value > 25000 && value < 60000) {
      const utcDays = Math.floor(value - 25569);
      const utcValue = utcDays * 86400 * 1000;
      const d = new Date(utcValue);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
    return null;
  }

  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const str = String(value).trim();
  if (!str) return null;

  if (format === "YYYY-MM-DD" && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  if (str.includes("/")) {
    const parts = str.split(/[\/\s]/)[0].split("/");
    if (parts.length >= 3) {
      if (format === "DD/MM/YYYY") {
        const [day, month, year] = parts;
        const fullYear = year.length === 2 ? `20${year}` : year;
        return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
      if (format === "MM/DD/YYYY") {
        const [month, day, year] = parts;
        const fullYear = year.length === 2 ? `20${year}` : year;
        return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }
  }

  // Try ISO as fallback
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  return null;
}

function parseQty(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const num = parseFloat(String(value).trim().replace(",", "."));
  return isNaN(num) ? null : num;
}

// ─── Component ───────────────────────────────────────────────────────
export function CMVSmartSalesImporter() {
  const { effectiveUnidadeId } = useUnidade();
  const { isAdmin, isPartner } = useUserProfile();
  const { importSales } = useDailySales(effectiveUnidadeId || undefined);
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("upload");
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: -1, product: -1, quantity: -1, amount: null });
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [result, setResult] = useState<SalesImportResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canClearSales = isAdmin || isPartner;

  // ── Fetch sales mappings (white list) ──
  const { data: salesMappings = [] } = useQuery({
    queryKey: ["cmv-sales-mappings-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_sales_mappings")
        .select("nome_venda, multiplicador, cmv_item_id, cmv_items!cmv_sales_mappings_cmv_item_id_fkey(nome)")
      if (error) throw error;
      return data as Array<{
        nome_venda: string;
        multiplicador: number;
        cmv_item_id: string;
        cmv_items: { nome: string } | null;
      }>;
    },
  });

  // Build a normalized lookup map: UPPER(TRIM(nome_venda)) -> mapping info
  const mappingsLookup = useMemo(() => {
    const map = new Map<string, { ingredientName: string; multiplicador: number }>();
    for (const m of salesMappings) {
      const key = m.nome_venda.toUpperCase().trim().replace(/\s+/g, " ");
      map.set(key, {
        ingredientName: m.cmv_items?.nome ?? "—",
        multiplicador: m.multiplicador,
      });
    }
    return map;
  }, [salesMappings]);

  // ── File reading ──
  const readFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    let headers: string[] = [];
    let rows: unknown[][] = [];

    if (name.endsWith(".csv")) {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error("Arquivo deve ter cabeçalho e pelo menos uma linha de dados");
      const sep = lines[0].includes(";") ? ";" : ",";
      headers = lines[0].split(sep).map(h => h.trim().replace(/"/g, ""));
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(sep).map(v => v.trim().replace(/"/g, ""));
        if (vals.every(v => !v)) continue;
        rows.push(vals);
      }
    } else {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: false, raw: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("Arquivo Excel vazio");
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
      if (json.length < 2) throw new Error("Arquivo deve ter cabeçalho e dados");
      headers = (json[0] || []).map(h => String(h ?? ""));
      rows = json.slice(1).filter(r => r && !r.every(c => c === null || c === undefined || String(c).trim() === ""));
    }

    return { headers, rows, fileName: file.name, totalRows: rows.length } as FileData;
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".csv") && !ext.endsWith(".xls") && !ext.endsWith(".xlsx")) {
      toast({ title: "Formato não suportado", description: "Aceitos: CSV, XLS, XLSX", variant: "destructive" });
      return;
    }
    try {
      const data = await readFile(file);
      setFileData(data);

      // Auto-guess mapping
      const autoMap: ColumnMapping = { date: -1, product: -1, quantity: -1, amount: null };
      data.headers.forEach((h, i) => {
        const role = guessColumnRole(h);
        if (role === "date" && autoMap.date === -1) autoMap.date = i;
        if (role === "product" && autoMap.product === -1) autoMap.product = i;
        if (role === "quantity" && autoMap.quantity === -1) autoMap.quantity = i;
        if (role === "amount" && autoMap.amount === null) autoMap.amount = i;
      });
      setMapping(autoMap);

      // Auto-detect date format from first 20 rows
      if (autoMap.date !== -1) {
        const samples = data.rows.slice(0, 20).map(r => r[autoMap.date]);
        setDateFormat(detectDateFormat(samples));
      }

      setStep("mapping");
    } catch (err) {
      toast({ title: "Erro ao ler arquivo", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
    }
  }, [readFile]);

  // ── Aggregated preview ──
  const aggregatedPreview = useMemo(() => {
    if (!fileData || mapping.date === -1 || mapping.product === -1 || mapping.quantity === -1) return null;

    const parsed: ParsedSaleRow[] = [];
    const failures: ParseFailure[] = [];

    for (let i = 0; i < fileData.rows.length; i++) {
      const row = fileData.rows[i];
      const rawDate = row[mapping.date];
      const rawProduct = row[mapping.product];
      const rawQty = row[mapping.quantity];
      const rawAmount = mapping.amount !== null ? row[mapping.amount] : 0;
      const rawStr = `Data=${String(rawDate ?? "")}, Item=${String(rawProduct ?? "")}, Qtd=${String(rawQty ?? "")}`;

      const itemName = rawProduct ? String(rawProduct).toUpperCase().trim() : null;
      if (!itemName) { failures.push({ line: i + 2, rawData: rawStr, reason: "Nome do item vazio" }); continue; }

      const saleDate = parseWithFormat(rawDate, dateFormat);
      if (!saleDate) { failures.push({ line: i + 2, rawData: rawStr, reason: "Data inválida" }); continue; }

      const qty = parseQty(rawQty);
      if (qty === null) { failures.push({ line: i + 2, rawData: rawStr, reason: "Quantidade inválida" }); continue; }

      const totalAmount = parseQty(rawAmount) ?? 0;
      parsed.push({ sale_date: saleDate, item_name: itemName, quantity: qty, total_amount: totalAmount });
    }

    const aggregated = aggregateSales(parsed);
    const uniqueDates = new Set(aggregated.map(r => r.sale_date));
    const uniqueProducts = new Set(aggregated.map(r => r.item_name));

    return { aggregated, failures, parsed, uniqueDates: uniqueDates.size, uniqueProducts: uniqueProducts.size };
  }, [fileData, mapping, dateFormat]);

  // ── White-list filtering: split matched vs unmatched ──
  const filteredPreview = useMemo(() => {
    if (!aggregatedPreview) return null;

    const matched: MatchedSaleItem[] = [];
    const unmatchedMap = new Map<string, number>();

    for (const row of aggregatedPreview.aggregated) {
      const normalizedName = row.item_name.toUpperCase().trim().replace(/\s+/g, " ");
      const link = mappingsLookup.get(normalizedName);

      if (link) {
        matched.push({
          ...row,
          ingredientName: link.ingredientName,
          multiplicador: link.multiplicador,
          consumo: row.quantity * link.multiplicador,
        });
      } else {
        unmatchedMap.set(row.item_name, (unmatchedMap.get(row.item_name) || 0) + row.quantity);
      }
    }

    const unmatched: UnmatchedSaleItem[] = Array.from(unmatchedMap, ([item_name, quantity]) => ({ item_name, quantity }));

    // Only matched parsed rows should be imported
    const matchedNames = new Set(matched.map(m => m.item_name));
    const filteredParsed = aggregatedPreview.parsed.filter(p =>
      matchedNames.has(p.item_name.toUpperCase().trim())
    );

    return { matched, unmatched, filteredParsed };
  }, [aggregatedPreview, mappingsLookup]);

  // ── Import (only matched items) ──
  const handleImport = async () => {
    if (!effectiveUnidadeId || !aggregatedPreview || !filteredPreview) return;
    if (filteredPreview.matched.length === 0) {
      toast({ title: "Nenhum item reconhecido", description: "Nenhum item possui vínculo configurado. Configure os vínculos no De-Para.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const importResult = await importSales.mutateAsync({
        unitId: effectiveUnidadeId,
        rows: filteredPreview.filteredParsed,
        parseFailures: aggregatedPreview.failures,
        totalFileLines: fileData?.totalRows ?? 0,
      });
      setResult(importResult);
      setShowResultModal(true);
      setStep("done");
    } catch (err) {
      toast({ title: "Erro na importação", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Clear sales ──
  const handleClearSales = async () => {
    if (!effectiveUnidadeId) return;
    setIsClearing(true);
    try {
      const { error } = await supabase.from("daily_sales").delete().eq("unit_id", effectiveUnidadeId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["daily-sales"] });
      toast({ title: "Base de vendas limpa", description: "Vínculos foram preservados." });
    } catch (err) {
      toast({ title: "Erro ao limpar vendas", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setIsClearing(false);
    }
  };

  // ── Reset wizard ──
  const resetWizard = () => {
    setStep("upload");
    setFileData(null);
    setMapping({ date: -1, product: -1, quantity: -1, amount: null });
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Validation ──
  const isMappingValid = mapping.date !== -1 && mapping.product !== -1 && mapping.quantity !== -1;
  const usedColumns = new Set([mapping.date, mapping.product, mapping.quantity, ...(mapping.amount !== null ? [mapping.amount] : [])]);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importador Inteligente de Vendas
          </CardTitle>
          <CardDescription>
            Upload de relatórios de PDV com mapeamento automático de colunas e agrupamento otimizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ── Step Indicator ── */}
          <StepIndicator current={step} />

          {/* ── STEP: Upload ── */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
              >
                <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium text-lg">Arraste o arquivo ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground mt-1">Suporta arquivos CSV, XLS e XLSX com milhares de linhas</p>
                <div className="flex gap-2 justify-center mt-3">
                  <Badge variant="secondary">CSV</Badge>
                  <Badge variant="secondary">XLS</Badge>
                  <Badge variant="secondary">XLSX</Badge>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: Column Mapping ── */}
          {step === "mapping" && fileData && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="font-medium">{fileData.fileName}</span>
                <Badge variant="outline">{fileData.totalRows.toLocaleString("pt-BR")} linhas</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MappingSelect
                  label="Data / Hora da Venda"
                  icon={<CalendarDays className="h-4 w-4" />}
                  required
                  value={mapping.date}
                  onChange={v => setMapping(m => ({ ...m, date: v }))}
                  headers={fileData.headers}
                  usedColumns={usedColumns}
                  currentKey="date"
                />
                <MappingSelect
                  label="Nome / Código do Produto"
                  icon={<Columns3 className="h-4 w-4" />}
                  required
                  value={mapping.product}
                  onChange={v => setMapping(m => ({ ...m, product: v }))}
                  headers={fileData.headers}
                  usedColumns={usedColumns}
                  currentKey="product"
                />
                <MappingSelect
                  label="Quantidade Vendida"
                  icon={<Zap className="h-4 w-4" />}
                  required
                  value={mapping.quantity}
                  onChange={v => setMapping(m => ({ ...m, quantity: v }))}
                  headers={fileData.headers}
                  usedColumns={usedColumns}
                  currentKey="quantity"
                />
                <MappingSelect
                  label="Valor Total (opcional)"
                  icon={<Zap className="h-4 w-4" />}
                  value={mapping.amount ?? -1}
                  onChange={v => setMapping(m => ({ ...m, amount: v === -1 ? null : v }))}
                  headers={fileData.headers}
                  usedColumns={usedColumns}
                  currentKey="amount"
                />
              </div>

              {/* Sample preview */}
              {isMappingValid && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
                    <Eye className="h-3.5 w-3.5 inline mr-1" /> Prévia das primeiras 5 linhas
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data (bruto)</TableHead>
                        <TableHead className="text-xs">Produto</TableHead>
                        <TableHead className="text-xs">Qtd</TableHead>
                        {mapping.amount !== null && <TableHead className="text-xs">Valor</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fileData.rows.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-mono">{String(row[mapping.date] ?? "")}</TableCell>
                          <TableCell className="text-xs">{String(row[mapping.product] ?? "")}</TableCell>
                          <TableCell className="text-xs">{String(row[mapping.quantity] ?? "")}</TableCell>
                          {mapping.amount !== null && <TableCell className="text-xs">{String(row[mapping.amount] ?? "")}</TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={resetWizard}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button onClick={() => setStep("dateformat")} disabled={!isMappingValid}>
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP: Date Format ── */}
          {step === "dateformat" && fileData && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-semibold">Formato de Data Detectado</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Confirme o formato das datas encontradas no arquivo.
                </p>
              </div>

              {/* Sample dates */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">Exemplos encontrados:</p>
                {fileData.rows.slice(0, 5).map((row, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs bg-background px-2 py-0.5 rounded">{String(row[mapping.date] ?? "—")}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">
                      {parseWithFormat(row[mapping.date], dateFormat) ?? <span className="text-destructive">Inválido</span>}
                    </span>
                  </div>
                ))}
              </div>

              <RadioGroup value={dateFormat} onValueChange={v => setDateFormat(v as DateFormat)} className="space-y-3">
                <div className="flex items-center space-x-3 border rounded-lg p-3">
                  <RadioGroupItem value="DD/MM/YYYY" id="ddmm" />
                  <Label htmlFor="ddmm" className="cursor-pointer flex-1">
                    <span className="font-medium">DD/MM/AAAA</span>
                    <span className="text-xs text-muted-foreground block">Padrão brasileiro (Ex: 12/02/2026)</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-3">
                  <RadioGroupItem value="MM/DD/YYYY" id="mmdd" />
                  <Label htmlFor="mmdd" className="cursor-pointer flex-1">
                    <span className="font-medium">MM/DD/AAAA</span>
                    <span className="text-xs text-muted-foreground block">Padrão americano (Ex: 02/12/2026)</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-3">
                  <RadioGroupItem value="YYYY-MM-DD" id="iso" />
                  <Label htmlFor="iso" className="cursor-pointer flex-1">
                    <span className="font-medium">AAAA-MM-DD</span>
                    <span className="text-xs text-muted-foreground block">ISO 8601 (Ex: 2026-02-12)</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-3">
                  <RadioGroupItem value="excel_serial" id="serial" />
                  <Label htmlFor="serial" className="cursor-pointer flex-1">
                    <span className="font-medium">Número Serial Excel</span>
                    <span className="text-xs text-muted-foreground block">Número sequencial (Ex: 46039)</span>
                  </Label>
                </div>
              </RadioGroup>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button onClick={() => setStep("preview")}>
                  Ver Prévia <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP: Preview (with White-List Filtering) ── */}
          {step === "preview" && aggregatedPreview && filteredPreview && fileData && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatMini label="Linhas no Arquivo" value={fileData.totalRows} />
                <StatMini label="Produtos Distintos" value={aggregatedPreview.uniqueProducts} />
                <StatMini label="✅ Reconhecidos" value={filteredPreview.matched.length} accent />
                <StatMini label="🗑️ Descartados" value={filteredPreview.unmatched.length} />
              </div>

              {aggregatedPreview.failures.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-600">{aggregatedPreview.failures.length} linhas com erro de parsing</p>
                    <p className="text-xs text-muted-foreground">Detalhes serão mostrados no relatório final.</p>
                  </div>
                </div>
              )}

              {/* White-list info */}
              <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                <Link2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Filtro por Vínculo (White List)</p>
                  <p className="text-xs text-muted-foreground">
                    Apenas itens com vínculo configurado no De-Para serão importados.
                    {filteredPreview.unmatched.length > 0 && ` ${filteredPreview.unmatched.length} itens sem vínculo serão ignorados.`}
                  </p>
                </div>
              </div>

              {/* Tabbed view: Recognized vs Discarded */}
              <Tabs defaultValue="matched" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="matched" className="gap-1.5">
                    <PackageCheck className="h-3.5 w-3.5" />
                    Reconhecidos ({filteredPreview.matched.length})
                  </TabsTrigger>
                  <TabsTrigger value="unmatched" className="gap-1.5">
                    <PackageX className="h-3.5 w-3.5" />
                    Descartados ({filteredPreview.unmatched.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="matched">
                  <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    {filteredPreview.matched.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <PackageX className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">Nenhum item reconhecido</p>
                        <p className="text-xs">Configure vínculos no De-Para de Vendas para que o sistema reconheça os itens.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Produto (Arquivo)</TableHead>
                            <TableHead className="text-xs">Vínculo (Ingrediente)</TableHead>
                            <TableHead className="text-xs text-right">Qtd Vendida</TableHead>
                            <TableHead className="text-xs text-right">Consumo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPreview.matched.slice(0, 30).map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">{r.item_name}</TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="font-normal text-xs">
                                  {r.ingredientName}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {r.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {r.consumo.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                                {r.multiplicador !== 1 && (
                                  <span className="text-muted-foreground ml-1">(×{r.multiplicador})</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredPreview.matched.length > 30 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-xs text-muted-foreground italic">
                                ...e mais {filteredPreview.matched.length - 30} itens reconhecidos
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="unmatched">
                  <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    {filteredPreview.unmatched.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-70" />
                        <p className="text-sm font-medium">Todos os itens possuem vínculo!</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Produto (Sem Vínculo)</TableHead>
                            <TableHead className="text-xs text-right">Qtd Total</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPreview.unmatched.slice(0, 50).map((r, i) => (
                            <TableRow key={i} className="opacity-60">
                              <TableCell className="text-xs">{r.item_name}</TableCell>
                              <TableCell className="text-xs text-right font-mono">
                                {r.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs font-normal">Ignorado</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredPreview.unmatched.length > 50 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-xs text-muted-foreground italic">
                                ...e mais {filteredPreview.unmatched.length - 50} itens ignorados
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("dateformat")}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                <Button onClick={handleImport} disabled={isProcessing || filteredPreview.matched.length === 0}>
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4 mr-2" /> Importar {filteredPreview.matched.length} itens reconhecidos</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP: Done ── */}
          {step === "done" && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <p className="font-medium text-lg">Importação Concluída!</p>
              <Button onClick={resetWizard} variant="outline">
                Nova Importação
              </Button>
            </div>
          )}

          {/* Clear Sales Button */}
          {canClearSales && effectiveUnidadeId && step === "upload" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={isClearing}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isClearing ? "Limpando..." : "Limpar Histórico de Vendas"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Atenção: Ação Irreversível</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso apagará TODAS as vendas importadas desta unidade. Os vínculos (De-Para) SERÃO MANTIDOS.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearSales} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sim, apagar vendas
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>

      {result && (
        <CMVImportSummaryModal open={showResultModal} onOpenChange={setShowResultModal} result={result} />
      )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "mapping", label: "Colunas" },
    { key: "dateformat", label: "Datas" },
    { key: "preview", label: "Prévia" },
    { key: "done", label: "Concluído" },
  ];
  const currentIdx = steps.findIndex(s => s.key === current);

  const getStepClass = (i: number) => {
    if (i === currentIdx) return "bg-primary text-primary-foreground";
    if (i < currentIdx) return "bg-primary/10 text-primary";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${getStepClass(i)}`}>
            {i < currentIdx ? <CheckCircle2 className="h-3 w-3" /> : <span>{i + 1}</span>}
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function MappingSelect({
  label, icon, required, value, onChange, headers, usedColumns, currentKey,
}: {
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  value: number;
  onChange: (v: number) => void;
  headers: string[];
  usedColumns: Set<number>;
  currentKey: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm flex items-center gap-1.5">
        {icon}
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={String(value)} onValueChange={v => onChange(parseInt(v, 10))}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a coluna" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="-1">— Nenhuma —</SelectItem>
          {headers.map((h, i) => {
            const isUsed = usedColumns.has(i) && value !== i;
            return (
              <SelectItem key={i} value={String(i)} disabled={isUsed}>
                {h || `Coluna ${i + 1}`}
                {isUsed && " (em uso)"}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatMini({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-center rounded-lg border p-3">
      <p className={`text-xl font-bold ${accent ? "text-primary" : ""}`}>{value.toLocaleString("pt-BR")}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
