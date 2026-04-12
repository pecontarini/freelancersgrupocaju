import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Plus, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useUtensiliosCatalog, useAllUtensiliosItems } from "@/hooks/useUtensilios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SETORES_UTENSILIOS } from "./SectorFilter";

interface ParsedRow {
  loja_id: string;
  loja_nome: string;
  catalog_item_id: string;
  item_nome: string;
  area_responsavel: string;
  estoque_minimo: number;
  valor_unitario: number;
  isNew: boolean;
  isValid: boolean;
  error?: string;
}

interface LojaGroup {
  loja_id: string;
  loja_nome: string;
  rows: ParsedRow[];
  newCount: number;
  updateCount: number;
  invalidCount: number;
}

export function BulkImportExport() {
  const { data: catalog } = useUtensiliosCatalog();
  const { data: allItems } = useAllUtensiliosItems();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: lojas } = useQuery({
    queryKey: ["config_lojas_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("config_lojas").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const [reviewOpen, setReviewOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importProgress, setImportProgress] = useState<number | null>(null);

  const existingMap = new Map<string, any>();
  allItems?.forEach((i: any) => {
    existingMap.set(`${i.catalog_item_id}__${i.loja_id}`, i);
  });

  const catalogIds = new Set(catalog?.map((c: any) => c.id) || []);
  const lojaIds = new Set(lojas?.map((l: any) => l.id) || []);

  const bulkImportMutation = useMutation({
    mutationFn: async (items: ParsedRow[]) => {
      const rows = items.filter(r => r.isValid).map((i) => ({
        catalog_item_id: i.catalog_item_id,
        loja_id: i.loja_id,
        estoque_minimo: i.estoque_minimo,
        valor_unitario: i.valor_unitario,
        area_responsavel: i.area_responsavel || "Front",
        is_active: true,
      }));
      const batchSize = 500;
      const totalBatches = Math.ceil(rows.length / batchSize);
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase
          .from("utensilios_items")
          .upsert(batch, { onConflict: "catalog_item_id,loja_id" });
        if (error) throw error;
        setImportProgress(Math.round(((i / batchSize + 1) / totalBatches) * 100));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utensilios_items"] });
      qc.invalidateQueries({ queryKey: ["utensilios_items_all"] });
      toast.success("Importação concluída com sucesso!");
      setReviewOpen(false);
      setParsed([]);
      setImportProgress(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setImportProgress(null);
    },
  });

  const handleExport = () => {
    if (!catalog || !lojas) {
      toast.error("Aguarde o carregamento dos dados.");
      return;
    }

    const headers = ["Unidade", "ID Unidade", "Código", "Utensílio", "ID Item", "Setor", "Estoque Mínimo", "Valor Unitário"];
    const rows: any[][] = [];

    for (const loja of lojas) {
      for (const item of catalog) {
        const existing = existingMap.get(`${item.id}__${loja.id}`);
        rows.push([
          loja.nome,
          loja.id,
          item.code || "",
          item.name,
          item.id,
          existing?.area_responsavel || "Front",
          existing?.estoque_minimo || 0,
          existing?.valor_unitario || 0,
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Style editable columns (F, G, H) with yellow background
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let R = 1; R <= range.e.r; R++) {
      for (const C of [5, 6, 7]) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[addr]) {
          ws[addr].s = { fill: { fgColor: { rgb: "FFFFF2CC" } } };
        }
      }
    }

    ws["!cols"] = [
      { wch: 28 },
      { wch: 38, hidden: true },
      { wch: 10 },
      { wch: 30 },
      { wch: 38, hidden: true },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque Mínimo");

    const instrWs = XLSX.utils.aoa_to_sheet([
      ["INSTRUÇÕES"],
      [""],
      ["1. Preencha as colunas 'Setor', 'Estoque Mínimo' e 'Valor Unitário'."],
      ["2. NÃO altere as colunas de Unidade, Utensílio ou IDs."],
      ["3. Setores válidos: " + SETORES_UTENSILIOS.filter(s => s !== "Todos").join(", ")],
      ["4. Após preencher, importe o arquivo de volta no sistema."],
      ["5. Linhas com Estoque Mínimo = 0 serão importadas (para zerar configurações)."],
    ]);
    instrWs["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, instrWs, "Instruções");

    XLSX.writeFile(wb, `modelo_utensilios_todas_unidades.xlsx`);
    toast.success("Modelo exportado!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets["Estoque Mínimo"] || wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        if (data.length < 2) {
          toast.error("Planilha vazia.");
          return;
        }

        const headerRow = data[0] as string[];
        const colMap: Record<string, number> = {};
        headerRow.forEach((h: string, i: number) => {
          const norm = (h || "").toString().trim().toLowerCase();
          if (norm.includes("id unidade")) colMap.lojaId = i;
          else if (norm.includes("id item")) colMap.itemId = i;
          else if (norm === "setor") colMap.setor = i;
          else if (norm.includes("estoque") || norm.includes("mínimo") || norm.includes("minimo")) colMap.minimo = i;
          else if (norm.includes("valor")) colMap.valor = i;
          else if (norm.includes("unidade") && !norm.includes("id")) colMap.lojaNome = i;
          else if (norm.includes("utensílio") || norm.includes("utensilio")) colMap.itemNome = i;
        });

        if (colMap.lojaId == null || colMap.itemId == null) {
          toast.error("Colunas de ID não encontradas. Use o modelo exportado.");
          return;
        }

        const rows: ParsedRow[] = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          if (!row || !row[colMap.lojaId] || !row[colMap.itemId]) continue;
          const min = parseInt(row[colMap.minimo] ?? 0) || 0;
          const lojaId = String(row[colMap.lojaId]).trim();
          const catalogItemId = String(row[colMap.itemId]).trim();

          const validLoja = lojaIds.has(lojaId);
          const validItem = catalogIds.has(catalogItemId);
          const isExisting = existingMap.has(`${catalogItemId}__${lojaId}`);

          let error: string | undefined;
          if (!validLoja) error = "Unidade não encontrada";
          else if (!validItem) error = "Item não encontrado no catálogo";

          rows.push({
            loja_id: lojaId,
            loja_nome: String(row[colMap.lojaNome] ?? "").trim(),
            catalog_item_id: catalogItemId,
            item_nome: String(row[colMap.itemNome] ?? "").trim(),
            area_responsavel: String(row[colMap.setor] ?? "Front").trim(),
            estoque_minimo: min,
            valor_unitario: parseFloat(row[colMap.valor] ?? 0) || 0,
            isNew: !isExisting,
            isValid: validLoja && validItem,
            error,
          });
        }

        if (rows.length === 0) {
          toast.error("Nenhuma linha encontrada na planilha.");
          return;
        }

        setParsed(rows);
        setReviewOpen(true);
      } catch (err: any) {
        toast.error("Erro ao ler arquivo: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = () => {
    setImportProgress(0);
    bulkImportMutation.mutate(parsed);
  };

  // Group by loja
  const groups: LojaGroup[] = (() => {
    const map = new Map<string, LojaGroup>();
    parsed.forEach((r) => {
      if (!map.has(r.loja_id)) {
        map.set(r.loja_id, {
          loja_id: r.loja_id,
          loja_nome: r.loja_nome || r.loja_id,
          rows: [],
          newCount: 0,
          updateCount: 0,
          invalidCount: 0,
        });
      }
      const g = map.get(r.loja_id)!;
      g.rows.push(r);
      if (!r.isValid) g.invalidCount++;
      else if (r.isNew) g.newCount++;
      else g.updateCount++;
    });
    return Array.from(map.values()).sort((a, b) => a.loja_nome.localeCompare(b.loja_nome));
  })();

  const validCount = parsed.filter(r => r.isValid).length;
  const invalidCount = parsed.filter(r => !r.isValid).length;
  const newCount = parsed.filter(r => r.isValid && r.isNew).length;
  const updateCount = parsed.filter(r => r.isValid && !r.isNew).length;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          Exportar Modelo
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" />
          Importar Planilha
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Revisão da Importação em Massa
            </DialogTitle>
          </DialogHeader>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{validCount}</p>
              <p className="text-xs text-muted-foreground">Válidos</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <Plus className="h-3.5 w-3.5 text-green-600" />
                <p className="text-2xl font-bold text-green-600">{newCount}</p>
              </div>
              <p className="text-xs text-muted-foreground">Novos</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                <p className="text-2xl font-bold text-blue-600">{updateCount}</p>
              </div>
              <p className="text-xs text-muted-foreground">Atualizados</p>
            </div>
            {invalidCount > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                  <p className="text-2xl font-bold text-destructive">{invalidCount}</p>
                </div>
                <p className="text-xs text-destructive">Inválidos</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{groups.length} unidade(s)</Badge>
            <Badge variant="outline">{new Set(parsed.map(r => r.catalog_item_id)).size} utensílio(s)</Badge>
          </div>

          {/* Progress bar */}
          {importProgress !== null && (
            <div className="space-y-1">
              <Progress value={importProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {importProgress < 100 ? `Processando... ${importProgress}%` : "Finalizando..."}
              </p>
            </div>
          )}

          {/* Grouped accordion */}
          <ScrollArea className="h-[45vh]">
            <Accordion type="multiple" className="space-y-1">
              {groups.map((g) => (
                <AccordionItem key={g.loja_id} value={g.loja_id} className="border rounded-lg px-3">
                  <AccordionTrigger className="py-2 hover:no-underline">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{g.loja_nome}</span>
                      <Badge variant="outline" className="text-[10px]">{g.rows.length}</Badge>
                      {g.newCount > 0 && (
                        <Badge className="bg-green-100 text-green-700 text-[10px]">
                          <Plus className="h-2.5 w-2.5 mr-0.5" />{g.newCount}
                        </Badge>
                      )}
                      {g.updateCount > 0 && (
                        <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                          <RefreshCw className="h-2.5 w-2.5 mr-0.5" />{g.updateCount}
                        </Badge>
                      )}
                      {g.invalidCount > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          <XCircle className="h-2.5 w-2.5 mr-0.5" />{g.invalidCount}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 px-1">Utensílio</th>
                          <th className="text-left py-1 px-1">Setor</th>
                          <th className="text-right py-1 px-1">Mín</th>
                          <th className="text-right py-1 px-1">Valor</th>
                          <th className="text-center py-1 px-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r, i) => (
                          <tr key={i} className={`border-b last:border-0 ${!r.isValid ? "bg-destructive/5" : ""}`}>
                            <td className="py-1.5 px-1 truncate max-w-[180px]">{r.item_nome}</td>
                            <td className="py-1.5 px-1">{r.area_responsavel}</td>
                            <td className="py-1.5 px-1 text-right font-mono">{r.estoque_minimo}</td>
                            <td className="py-1.5 px-1 text-right font-mono">{r.valor_unitario.toFixed(2)}</td>
                            <td className="py-1.5 px-1 text-center">
                              {!r.isValid ? (
                                <span className="text-destructive flex items-center justify-center gap-0.5" title={r.error}>
                                  <XCircle className="h-3 w-3" />
                                </span>
                              ) : r.isNew ? (
                                <span className="text-green-600 flex items-center justify-center gap-0.5">
                                  <Plus className="h-3 w-3" />
                                </span>
                              ) : (
                                <span className="text-blue-600 flex items-center justify-center gap-0.5">
                                  <CheckCircle2 className="h-3 w-3" />
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleConfirmImport}
              disabled={bulkImportMutation.isPending || validCount === 0}
            >
              {bulkImportMutation.isPending ? "Importando..." : `Confirmar ${validCount} registros`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
