import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Upload, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useUtensiliosCatalog, useAllUtensiliosItems, useBulkImportUtensiliosItems } from "@/hooks/useUtensilios";
import { useQuery } from "@tanstack/react-query";
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
}

export function BulkImportExport() {
  const { data: catalog } = useUtensiliosCatalog();
  const { data: allItems } = useAllUtensiliosItems();
  const bulkImport = useBulkImportUtensiliosItems();
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

  // Build lookup of existing items
  const existingMap = new Map<string, any>();
  allItems?.forEach((i: any) => {
    existingMap.set(`${i.catalog_item_id}__${i.loja_id}`, i);
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
          existing?.area_responsavel || "Salão",
          existing?.estoque_minimo || 0,
          existing?.valor_unitario || 0,
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Set column widths
    ws["!cols"] = [
      { wch: 28 }, // Unidade
      { wch: 38, hidden: true }, // ID Unidade (hidden)
      { wch: 10 }, // Código
      { wch: 30 }, // Utensílio
      { wch: 38, hidden: true }, // ID Item (hidden)
      { wch: 14 }, // Setor
      { wch: 16 }, // Estoque Mínimo
      { wch: 16 }, // Valor Unitário
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque Mínimo");

    // Instructions sheet
    const instrWs = XLSX.utils.aoa_to_sheet([
      ["INSTRUÇÕES"],
      [""],
      ["1. Preencha as colunas 'Setor', 'Estoque Mínimo' e 'Valor Unitário'."],
      ["2. NÃO altere as colunas de Unidade, Utensílio ou IDs."],
      ["3. Setores válidos: " + SETORES_UTENSILIOS.filter(s => s !== "Todos").join(", ")],
      ["4. Após preencher, importe o arquivo de volta no sistema."],
      ["5. Apenas linhas com Estoque Mínimo > 0 serão importadas."],
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

        // Find header row
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
          if (min <= 0) continue;
          rows.push({
            loja_id: String(row[colMap.lojaId]).trim(),
            loja_nome: String(row[colMap.lojaNome] ?? "").trim(),
            catalog_item_id: String(row[colMap.itemId]).trim(),
            item_nome: String(row[colMap.itemNome] ?? "").trim(),
            area_responsavel: String(row[colMap.setor] ?? "Front").trim(),
            estoque_minimo: min,
            valor_unitario: parseFloat(row[colMap.valor] ?? 0) || 0,
          });
        }

        if (rows.length === 0) {
          toast.error("Nenhuma linha com estoque mínimo > 0 encontrada.");
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
    const payload = parsed.map((r) => ({
      catalog_item_id: r.catalog_item_id,
      loja_id: r.loja_id,
      estoque_minimo: r.estoque_minimo,
      valor_unitario: r.valor_unitario,
      area_responsavel: r.area_responsavel,
    }));
    bulkImport.mutate(payload, {
      onSuccess: () => {
        setReviewOpen(false);
        setParsed([]);
      },
    });
  };

  const uniqueLojas = [...new Set(parsed.map((r) => r.loja_id))].length;
  const uniqueItems = [...new Set(parsed.map((r) => r.catalog_item_id))].length;

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
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Revisão da Importação
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline">{uniqueLojas} unidade(s)</Badge>
            <Badge variant="outline">{uniqueItems} utensílio(s)</Badge>
            <Badge className="bg-primary">{parsed.length} registros</Badge>
          </div>

          <ScrollArea className="h-[45vh] border rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="text-left p-2">Unidade</th>
                  <th className="text-left p-2">Utensílio</th>
                  <th className="text-left p-2">Setor</th>
                  <th className="text-right p-2">Mín</th>
                  <th className="text-right p-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 truncate max-w-[150px]">{r.loja_nome}</td>
                    <td className="p-2 truncate max-w-[150px]">{r.item_nome}</td>
                    <td className="p-2">{r.area_responsavel}</td>
                    <td className="p-2 text-right font-mono">{r.estoque_minimo}</td>
                    <td className="p-2 text-right font-mono">{r.valor_unitario.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 200 && (
              <p className="text-center text-xs text-muted-foreground py-2">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Mostrando 200 de {parsed.length} registros
              </p>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmImport} disabled={bulkImport.isPending}>
              {bulkImport.isPending ? "Importando..." : `Confirmar ${parsed.length} registros`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
