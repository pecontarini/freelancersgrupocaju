import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Save, Network, Copy, Eraser } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useUtensiliosCatalog,
  useAllUtensiliosItems,
  useBulkImportUtensiliosItems,
} from "@/hooks/useUtensilios";
import { SETORES_UTENSILIOS } from "./SectorFilter";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type CellMap = Record<string, Record<string, number>>; // catalog_id -> loja_id -> minimum
type SectorMap = Record<string, string>; // catalog_id -> sector default

export function GlobalMinimumStockMatrix({ open, onOpenChange }: Props) {
  const { data: catalog, isLoading: loadingCatalog } = useUtensiliosCatalog();
  const { data: allItems, isLoading: loadingItems } = useAllUtensiliosItems();
  const bulkImport = useBulkImportUtensiliosItems();

  const { data: lojas } = useQuery({
    queryKey: ["config_lojas_all_matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_lojas")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("Todos");
  const [edits, setEdits] = useState<CellMap>({});
  const [sectorEdits, setSectorEdits] = useState<SectorMap>({});

  // Build current state from DB
  const currentMap = useMemo(() => {
    const cells: CellMap = {};
    const sectors: SectorMap = {};
    allItems?.forEach((i: any) => {
      if (!cells[i.catalog_item_id]) cells[i.catalog_item_id] = {};
      cells[i.catalog_item_id][i.loja_id] = Number(i.estoque_minimo) || 0;
      if (!sectors[i.catalog_item_id]) {
        sectors[i.catalog_item_id] = i.area_responsavel || "Front";
      }
    });
    return { cells, sectors };
  }, [allItems]);

  // Reset edits when dialog opens
  useEffect(() => {
    if (open) {
      setEdits({});
      setSectorEdits({});
      setSearch("");
      setSectorFilter("Todos");
    }
  }, [open]);

  const getCellValue = (itemId: string, lojaId: string) => {
    if (edits[itemId]?.[lojaId] !== undefined) return edits[itemId][lojaId];
    return currentMap.cells[itemId]?.[lojaId] ?? 0;
  };

  const getSector = (itemId: string) => {
    return sectorEdits[itemId] ?? currentMap.sectors[itemId] ?? "Front";
  };

  const setCellValue = (itemId: string, lojaId: string, value: number) => {
    setEdits((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [lojaId]: value },
    }));
  };

  const setSector = (itemId: string, sector: string) => {
    setSectorEdits((prev) => ({ ...prev, [itemId]: sector }));
  };

  const filteredCatalog = useMemo(() => {
    if (!catalog) return [];
    const q = search.toLowerCase();
    return catalog.filter((c: any) => {
      const matchesSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (sectorFilter !== "Todos") {
        const sec = getSector(c.id);
        if (sec !== sectorFilter) return false;
      }
      return true;
    });
  }, [catalog, search, sectorFilter, sectorEdits, currentMap.sectors]);

  // Apply value to all stores in current row
  const applyToAll = (itemId: string, value: number) => {
    if (!lojas) return;
    setEdits((prev) => {
      const row: Record<string, number> = { ...(prev[itemId] || {}) };
      lojas.forEach((l: any) => {
        row[l.id] = value;
      });
      return { ...prev, [itemId]: row };
    });
  };

  // Clear row
  const clearRow = (itemId: string) => {
    if (!lojas) return;
    setEdits((prev) => {
      const row: Record<string, number> = { ...(prev[itemId] || {}) };
      lojas.forEach((l: any) => {
        row[l.id] = 0;
      });
      return { ...prev, [itemId]: row };
    });
  };

  // Compute changed rows for save
  const changedRows = useMemo(() => {
    const rows: Array<{
      catalog_item_id: string;
      loja_id: string;
      estoque_minimo: number;
      area_responsavel: string;
    }> = [];
    Object.entries(edits).forEach(([itemId, lojaMap]) => {
      const sector = getSector(itemId);
      Object.entries(lojaMap).forEach(([lojaId, val]) => {
        const original = currentMap.cells[itemId]?.[lojaId] ?? 0;
        const originalSector = currentMap.sectors[itemId] ?? "Front";
        if (val !== original || sector !== originalSector) {
          rows.push({
            catalog_item_id: itemId,
            loja_id: lojaId,
            estoque_minimo: val,
            area_responsavel: sector,
          });
        }
      });
    });
    // Also pick up sector-only edits (no value change but sector changed) — apply across all configured stores
    Object.entries(sectorEdits).forEach(([itemId, newSector]) => {
      const originalSector = currentMap.sectors[itemId];
      if (newSector !== originalSector) {
        const itemCells = currentMap.cells[itemId] || {};
        Object.entries(itemCells).forEach(([lojaId, val]) => {
          const alreadyIncluded = rows.find(
            (r) => r.catalog_item_id === itemId && r.loja_id === lojaId
          );
          if (!alreadyIncluded) {
            rows.push({
              catalog_item_id: itemId,
              loja_id: lojaId,
              estoque_minimo: val,
              area_responsavel: newSector,
            });
          }
        });
      }
    });
    return rows;
  }, [edits, sectorEdits, currentMap]);

  const handleSave = () => {
    if (changedRows.length === 0) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }
    bulkImport.mutate(changedRows, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const isLoading = loadingCatalog || loadingItems || !lojas;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] max-h-[95vh] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Estoques Mínimos da Rede — Edição em Matriz
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar utensílio por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SETORES_UTENSILIOS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-2 text-xs">
          <Badge variant="outline">
            {filteredCatalog.length} de {catalog?.length || 0} utensílios
          </Badge>
          <Badge variant="outline">{lojas?.length || 0} unidades</Badge>
          {changedRows.length > 0 && (
            <Badge className="bg-primary text-primary-foreground">
              {changedRows.length} alteração(ões) pendente(s)
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ScrollArea className="h-[65vh] border rounded-md">
            <div className="min-w-max">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-background z-10 shadow-sm">
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 sticky left-0 bg-background min-w-[220px] border-r">
                      Utensílio
                    </th>
                    <th className="text-left py-2 px-2 min-w-[90px] border-r">
                      Setor
                    </th>
                    <th className="text-center py-2 px-1 min-w-[90px] border-r">
                      Ações
                    </th>
                    {lojas?.map((loja: any) => (
                      <th
                        key={loja.id}
                        className="text-center py-2 px-1 min-w-[80px] font-medium border-r last:border-r-0"
                        title={loja.nome}
                      >
                        <div className="truncate max-w-[80px]">{loja.nome}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((item: any) => (
                    <tr
                      key={item.id}
                      className="border-b hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-1.5 px-2 sticky left-0 bg-background border-r">
                        <div className="font-medium truncate max-w-[220px]">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.code} · {item.unit || "UN"}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 border-r">
                        <Select
                          value={getSector(item.id)}
                          onValueChange={(v) => setSector(item.id, v)}
                        >
                          <SelectTrigger className="h-7 text-xs w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SETORES_UTENSILIOS.filter((s) => s !== "Todos").map(
                              (s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5 px-1 border-r">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Aplicar valor da primeira loja a todas"
                            onClick={() => {
                              const firstLoja = lojas?.[0];
                              if (!firstLoja) return;
                              const val = getCellValue(item.id, firstLoja.id);
                              applyToAll(item.id, val);
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            title="Zerar linha"
                            onClick={() => clearRow(item.id)}
                          >
                            <Eraser className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                      {lojas?.map((loja: any) => {
                        const val = getCellValue(item.id, loja.id);
                        const original =
                          currentMap.cells[item.id]?.[loja.id] ?? 0;
                        const changed =
                          edits[item.id]?.[loja.id] !== undefined &&
                          val !== original;
                        return (
                          <td
                            key={loja.id}
                            className="py-1 px-1 border-r last:border-r-0"
                          >
                            <Input
                              type="number"
                              min={0}
                              value={val || ""}
                              onChange={(e) =>
                                setCellValue(
                                  item.id,
                                  loja.id,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              placeholder="0"
                              className={`h-7 text-xs text-center px-1 ${
                                changed
                                  ? "border-primary bg-primary/5 font-semibold"
                                  : ""
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <tr>
                      <td
                        colSpan={(lojas?.length || 0) + 3}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Nenhum utensílio encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <p className="text-xs text-muted-foreground flex-1">
            Dica: use o ícone de copiar para replicar o valor da primeira loja
            em toda a linha. Células alteradas ficam destacadas.
          </p>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bulkImport.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={bulkImport.isPending || changedRows.length === 0}
          >
            <Save className="h-4 w-4 mr-2" />
            {bulkImport.isPending
              ? "Salvando..."
              : `Salvar ${changedRows.length} alteração(ões)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
