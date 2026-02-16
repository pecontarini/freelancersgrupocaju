import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useCMVItems } from "@/hooks/useCMV";
import { useCMVContagens } from "@/hooks/useCMVContagens";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { supabase } from "@/integrations/supabase/client";
import { findBestMatch, type MatchOption } from "@/lib/fuzzyMatch";
import { parseChecklistFacilFile } from "@/lib/checklistFacilParser";

interface MappedRow {
  fileItem: string;
  matchedName: string | null;
  matchedId: string | null;
  similarity: number;
  quantidade: number;
  originalQuantidade: number; // value from file, used to determine editability
  status: "matched" | "fuzzy" | "unmatched";
}

export function CMVChecklistFacilImporter() {
  const { effectiveUnidadeId } = useUnidade();
  const { isAdmin, unidades } = useUserProfile();
  const { options: allLojas } = useConfigLojas();

  // Available units: admin sees all, others see their assigned stores
  const availableUnits = isAdmin ? allLojas : unidades;

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [detectedUnit, setDetectedUnit] = useState<string | null>(null);

  // Editable session fields
  const [selectedDate, setSelectedDate] = useState<string>(""); // YYYY-MM-DD
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [unitMismatchWarning, setUnitMismatchWarning] = useState(false);

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

  // Dynamic contagens hook based on selected unit
  const { bulkUpsertContagens } = useCMVContagens(selectedUnitId || effectiveUnidadeId || undefined);

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

      // --- Unit Binding Logic ---
      let resolvedUnitId = effectiveUnidadeId;
      let mismatch = false;
      setDetectedUnit(result.detectedUnit);

      if (result.detectedUnit && availableUnits.length > 0) {
        const fileUnitUpper = result.detectedUnit.toUpperCase().trim();
        const matchedUnit = availableUnits.find((u) => {
          const uName = u.nome.toUpperCase().trim();
          return fileUnitUpper.includes(uName) || uName.includes(fileUnitUpper);
        });

        if (matchedUnit) {
          resolvedUnitId = matchedUnit.id;
        } else {
          // Fallback to current unit, show warning
          mismatch = true;
          resolvedUnitId = effectiveUnidadeId;
        }
      }

      setSelectedUnitId(resolvedUnitId);
      setUnitMismatchWarning(mismatch);

      // --- Date Binding ---
      setSelectedDate(result.detectedDate || "");

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
          originalQuantidade: row.quantidade,
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
    if (!selectedUnitId) {
      toast.error("Selecione uma unidade de destino");
      return;
    }
    if (!selectedDate) {
      toast.error("Informe a data da contagem");
      return;
    }

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
        loja_id: selectedUnitId,
        data_contagem: selectedDate,
        quantidade: r.quantidade,
        preco_custo_snapshot: costMap.get(r.matchedId!) || 0,
      }));

      await bulkUpsertContagens.mutateAsync(contagens);

      const formattedDate = selectedDate.split("-").reverse().join("/");
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

  // Format for display
  const displayDate = selectedDate
    ? selectedDate.split("-").reverse().join("/")
    : "N/A";

  const selectedUnitName = availableUnits.find((u) => u.id === selectedUnitId)?.nome || "—";

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
            {unitMismatchWarning && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Unidade Divergente</AlertTitle>
                <AlertDescription>
                  O arquivo pertence à unidade{" "}
                  <strong>{detectedUnit}</strong>, mas não foi encontrada correspondência.
                  A unidade atual foi usada como fallback. Confirme abaixo.
                </AlertDescription>
              </Alert>
            )}

            {/* Session Data (editable date + unit) */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Dados da Sessão
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Data da Contagem
                  </Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Store className="h-3.5 w-3.5" />
                    Unidade de Destino
                  </Label>
                  <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUnits.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Stats badges */}
            <div className="flex flex-wrap items-center gap-2">
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
                      <TableCell className="text-right">
                        {row.originalQuantidade > 0 ? (
                          <span className="font-mono">{row.quantidade}</span>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={row.quantidade || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setMappedRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, quantidade: val } : r
                                )
                              );
                            }}
                            className="w-20 text-center"
                          />
                        )}
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
              disabled={isSubmitting || stats.matched + stats.fuzzy === 0 || !selectedUnitId || !selectedDate}
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
