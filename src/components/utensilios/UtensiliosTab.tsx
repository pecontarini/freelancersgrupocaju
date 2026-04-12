import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContagemSemanal } from "./ContagemSemanal";
import { ControleBudget } from "./ControleBudget";
import { HistoricoContagens } from "./HistoricoContagens";
import { DashboardUtensilios } from "./DashboardUtensilios";
import { BulkImportExport } from "./BulkImportExport";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUtensiliosCatalog, useUtensiliosItems, useBulkCreateUtensiliosItems } from "@/hooks/useUtensilios";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Save, Search, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SETORES_UTENSILIOS } from "./SectorFilter";

export function UtensiliosTab() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const isMobile = useIsMobile();
  const { effectiveUnidadeId } = useUnidade();

  const { data: catalog, isLoading: loadingCatalog } = useUtensiliosCatalog();
  const { data: storeItems } = useUtensiliosItems(effectiveUnidadeId);
  const bulkCreate = useBulkCreateUtensiliosItems();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [minimums, setMinimums] = useState<Record<string, number>>({});
  const [sectors, setSectors] = useState<Record<string, string>>({});

  const storeMap: Record<string, any> = {};
  storeItems?.forEach((si: any) => { storeMap[si.catalog_item_id] = si; });

  const hasStoreConfig = storeItems && storeItems.length > 0;
  const configuredCount = storeItems?.length || 0;
  const totalCount = catalog?.length || 0;

  const filteredCatalog = (() => {
    if (!catalog) return [];
    const q = search.toLowerCase();
    return catalog.filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q)
    );
  })();

  const handleOpenDialog = () => {
    const initialMin: Record<string, number> = {};
    const initialSec: Record<string, string> = {};
    storeItems?.forEach((si: any) => {
      initialMin[si.catalog_item_id] = si.estoque_minimo;
      initialSec[si.catalog_item_id] = si.area_responsavel || "Salão";
    });
    setMinimums(initialMin);
    setSectors(initialSec);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!effectiveUnidadeId || !catalog) return;
    const entries = Object.entries(minimums)
      .filter(([, v]) => v > 0)
      .map(([catalogId, min]) => ({
        catalog_item_id: catalogId,
        loja_id: effectiveUnidadeId,
        estoque_minimo: min,
        area_responsavel: sectors[catalogId] || "Salão",
      }));
    if (entries.length === 0) return;
    bulkCreate.mutate(entries, {
      onSuccess: () => setDialogOpen(false),
    });
  };

  if (!effectiveUnidadeId) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className={isMobile ? "space-y-3" : "flex items-center justify-between"}>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            <Package className="h-3 w-3 mr-1" />
            {totalCount} itens no catálogo
          </Badge>
          {hasStoreConfig && (
            <Badge className="bg-primary text-primary-foreground text-xs">
              {configuredCount} configurados nesta loja
            </Badge>
          )}
        </div>
        <div className={isMobile ? "flex flex-col gap-2" : "flex items-center gap-2"}>
          <BulkImportExport />
          <Button onClick={handleOpenDialog} variant={hasStoreConfig ? "outline" : "default"} className={isMobile ? "w-full" : ""}>
            <Settings2 className="h-4 w-4 mr-2" />
            {hasStoreConfig ? "Ajustar Estoques Mínimos" : "Definir Estoque Inicial"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className={isMobile ? "overflow-x-auto -mx-2 px-2" : ""}>
          <TabsList className={isMobile ? "inline-flex w-auto min-w-full" : "grid w-full grid-cols-4"}>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="contagem">{isMobile ? "Contagem" : "Contagem Semanal"}</TabsTrigger>
            <TabsTrigger value="budget">{isMobile ? "Compras" : "Controle de Compras"}</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard"><DashboardUtensilios /></TabsContent>
        <TabsContent value="contagem"><ContagemSemanal /></TabsContent>
        <TabsContent value="budget"><ControleBudget /></TabsContent>
        <TabsContent value="historico"><HistoricoContagens /></TabsContent>
      </Tabs>

      {/* Dialog: Definir Estoque Inicial */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={isMobile ? "max-w-[95vw] max-h-[90vh] p-4" : "max-w-2xl max-h-[85vh]"}>
          <DialogHeader>
            <DialogTitle>{hasStoreConfig ? "Ajustar Estoques Mínimos" : "Definir Estoque Inicial"}</DialogTitle>
          </DialogHeader>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar utensílio..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loadingCatalog ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <ScrollArea className={isMobile ? "h-[55vh]" : "h-[50vh]"}>
              <div className="space-y-1.5 pr-3">
                {filteredCatalog.map((item: any) => {
                  const existing = storeMap[item.id];
                  const val = minimums[item.id] ?? existing?.estoque_minimo ?? 0;
                  const sec = sectors[item.id] ?? existing?.area_responsavel ?? "Salão";
                  return (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.code} · {item.unit || "UN"}</p>
                      </div>
                      {existing && <Badge variant="outline" className="text-[10px] shrink-0">OK</Badge>}
                      <Select value={sec} onValueChange={(v) => setSectors(prev => ({ ...prev, [item.id]: v }))}>
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SETORES_UTENSILIOS.filter(s => s !== "Todos").map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        className="w-16 text-right h-8"
                        placeholder="Mín"
                        value={val || ""}
                        onChange={(e) => setMinimums(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className={isMobile ? "flex-col gap-2" : ""}>
            <p className="text-xs text-muted-foreground flex-1">
              {Object.values(minimums).filter(v => v > 0).length} itens com mínimo definido
            </p>
            <Button onClick={handleSave} disabled={bulkCreate.isPending} className={isMobile ? "w-full" : ""}>
              <Save className="h-4 w-4 mr-2" />
              {bulkCreate.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
