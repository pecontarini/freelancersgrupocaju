import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  CalendarIcon,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useCMVItems } from "@/hooks/useCMV";
import { useCMVContagens } from "@/hooks/useCMVContagens";
import { supabase } from "@/integrations/supabase/client";
import { findBestMatch, type MatchOption } from "@/lib/fuzzyMatch";
import {
  parseChecklistFacilFile,
} from "@/lib/checklistFacilParser";

interface MappedRow {
  fileItem: string;
  matchedName: string | null;
  matchedId: string | null;
  similarity: number;
  quantidade: number;
  status: "matched" | "fuzzy" | "unmatched";
}

export function CMVChecklistFacilImporter() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: unitName } = useQuery({
    queryKey: ["unit-name", effectiveUnidadeId],
    queryFn: async () => {
      if (!effectiveUnidadeId) return null;
      const { data } = await supabase
        .from("config_lojas")
        .select("nome")
        .eq("id", effectiveUnidadeId)
        .single();
      return data?.nome || null;
    },
    enabled: !!effectiveUnidadeId,
  });
  const { items: cmvItems } = useCMVItems();
  const { bulkUpsertContagens } = useCMVContagens(effectiveUnidadeId || undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [detectedDate, setDetectedDate] = useState<string | null>(null);
  const [detectedUnit, setDetectedUnit] = useState<string | null>(null);
  const [unitMismatch, setUnitMismatch] = useState(false);

  const activeItems: MatchOption[] = useMemo(
    () => cmvItems.filter((i) => i.ativo).map((i) => ({ id: i.id, nome: i.nome })),
    [cmvItems]
  );

  const stats = useMemo(() => {
    const matched = mappedRows.filter((r) => r.status === "matched").length;
    const fuzzy = mappedRows.filter((r) => r.status === "fuzzy").length;
    const unmatched = mappedRows.filter((r) => r.status === "unmatched").length;
    return { matched, fuzzy, unmatched, total: mappedRows.length };
  }, [mappedRows]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!effectiveUnidadeId) {
      toast.error("Selecione uma unidade antes de importar");
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseChecklistFacilFile(file);

      if (result.rows.length === 0) {
        toast.error("Nenhum item válido encontrado no arquivo");
        return;
      }

      // Check unit mismatch
      if (result.detectedUnit && unitName) {
        const fileUnit = result.detectedUnit.toUpperCase().trim();
        const systemUnit = unitName.toUpperCase().trim();
        const mismatch = !fileUnit.includes(systemUnit) && !systemUnit.includes(fileUnit);
        setUnitMismatch(mismatch);
        setDetectedUnit(result.detectedUnit);
      } else {
        setUnitMismatch(false);
        setDetectedUnit(result.detectedUnit);
      }

      setDetectedDate(result.detectedDate);

      // Map rows to ingredients
      const mapped: MappedRow[] = result.rows.map((row) => {
        const match = findBestMatch(row.itemName, activeItems);
        let status: MappedRow["status"] = "unmatched";
        if (match.isExactMatch || match.similarity >= 0.85) {
          status = "matched";
        } else if (match.matchId && match.similarity >= 0.5) {
          status = "fuzzy";
        }

        return {
          fileItem: row.itemName,
          matchedName: match.match,
          matchedId: match.matchId,
          similarity: match.similarity,
          quantidade: row.quantidade,
          status,
        };
      });

      setMappedRows(mapped);
      setShowModal(true);
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Erro ao ler o arquivo. Verifique o formato.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!effectiveUnidadeId || !detectedDate) return;

    const validRows = mappedRows.filter((r) => r.matchedId);
    if (validRows.length === 0) {
      toast.error("Nenhum item vinculado para salvar");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current costs for each item
      const itemIds = validRows.map((r) => r.matchedId!);
      const { data: itemsData } = await supabase
        .from("cmv_items")
        .select("id, preco_custo_atual")
        .in("id", itemIds);

      const costMap = new Map(
        (itemsData || []).map((i) => [i.id, i.preco_custo_atual])
      );

      const contagens = validRows.map((r) => ({
        cmv_item_id: r.matchedId!,
        loja_id: effectiveUnidadeId,
        data_contagem: detectedDate,
        quantidade: r.quantidade,
        preco_custo_snapshot: costMap.get(r.matchedId!) || 0,
      }));

      await bulkUpsertContagens.mutateAsync(contagens);

      const formattedDate = detectedDate.split("-").reverse().join("/");
      toast.success(
        `Estoque atualizado com sucesso baseado na contagem de ${formattedDate}.`
      );
      setShowModal(false);
      setMappedRows([]);
    } catch (error) {
      console.error("Error saving contagens:", error);
      toast.error("Erro ao salvar contagens");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = detectedDate
    ? detectedDate.split("-").reverse().join("/")
    : "N/A";

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileSelect}
      />

      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isParsing || !effectiveUnidadeId}
      >
        {isParsing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        Importar Contagem (Checklist Fácil)
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Confirmar Importação de Contagem?
            </DialogTitle>
            <DialogDescription>
              Revise os dados antes de atualizar o estoque.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Unit mismatch warning */}
            {unitMismatch && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Unidade Divergente</AlertTitle>
                <AlertDescription>
                  O arquivo pertence à unidade{" "}
                  <strong>{detectedUnit}</strong>, mas você está na unidade{" "}
                  <strong>{unitName}</strong>.
                </AlertDescription>
              </Alert>
            )}

            {/* Date + stats */}
            <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Data Detectada:</span>
                <Badge variant="secondary" className="text-base font-semibold">
                  {formattedDate}
                </Badge>
              </div>
              <div className="flex gap-2 ml-auto">
                <Badge variant="default">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {stats.matched} vinculados
                </Badge>
                {stats.fuzzy > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    <HelpCircle className="h-3 w-3 mr-1" />
                    {stats.fuzzy} aproximados
                  </Badge>
                )}
                {stats.unmatched > 0 && (
                  <Badge variant="outline" className="text-destructive border-destructive/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {stats.unmatched} não vinculados
                  </Badge>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome no Arquivo</TableHead>
                    <TableHead>Ingrediente Correspondente</TableHead>
                    <TableHead className="text-right w-[100px]">Quantidade</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className={
                        row.status === "unmatched" ? "bg-amber-50/50 dark:bg-amber-950/10" : ""
                      }
                    >
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">
                        {row.fileItem}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.matchedName ? (
                          <span>{row.matchedName}</span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.quantidade}
                      </TableCell>
                      <TableCell>
                        {row.status === "matched" && (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            OK
                          </Badge>
                        )}
                        {row.status === "fuzzy" && (
                          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                            <HelpCircle className="h-3 w-3" />
                            ~{Math.round(row.similarity * 100)}%
                          </Badge>
                        )}
                        {row.status === "unmatched" && (
                          <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
                            <AlertTriangle className="h-3 w-3" />
                            Não vinculado
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting || stats.matched + stats.fuzzy === 0 || unitMismatch}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar e Atualizar Estoque ({stats.matched + stats.fuzzy})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
