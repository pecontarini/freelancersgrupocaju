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
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Save, Search, Package, Link2, Copy, Share2, Lock, Network, FileUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SETORES_UTENSILIOS } from "./SectorFilter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { GlobalMinimumStockMatrix } from "./GlobalMinimumStockMatrix";
import { UtensiliosImportPDFDialog } from "./UtensiliosImportPDFDialog";
import { GaleriaFotos } from "./GaleriaFotos";

export function UtensiliosTab() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const isMobile = useIsMobile();
  const { effectiveUnidadeId } = useUnidade();

  const { isAdmin, isGerenteUnidade } = useUserProfile();
  const canManageLinks = isAdmin || isGerenteUnidade;

  const { data: catalog, isLoading: loadingCatalog } = useUtensiliosCatalog();
  const { data: storeItems } = useUtensiliosItems(effectiveUnidadeId);
  const bulkCreate = useBulkCreateUtensiliosItems();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [pdfImportOpen, setPdfImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [minimums, setMinimums] = useState<Record<string, number>>({});
  const [sectors, setSectors] = useState<Record<string, string>>({});
  const [pinValue, setPinValue] = useState("");
  const [pinLoaded, setPinLoaded] = useState(false);

  // Load current PIN
  useState(() => {
    if (effectiveUnidadeId && canManageLinks) {
      supabase
        .from("config_lojas")
        .select("pin_contagem")
        .eq("id", effectiveUnidadeId)
        .single()
        .then(({ data }) => {
          setPinValue((data as any)?.pin_contagem || "");
          setPinLoaded(true);
        });
    }
  });

  const PRODUCTION_URL = "https://freelancersgrupocaju.lovable.app";
  const countingLink = effectiveUnidadeId
    ? `${PRODUCTION_URL}/contagem-utensilios/${effectiveUnidadeId}`
    : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(countingLink);
    toast.success("Link copiado!");
  };

  const handleShareWhatsApp = () => {
    const msg = encodeURIComponent(`📋 Link para contagem de utensílios:\n${countingLink}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleSavePin = async () => {
    if (!effectiveUnidadeId) return;
    if (pinValue && !/^\d{4}$/.test(pinValue)) {
      toast.error("O PIN deve ter exatamente 4 dígitos numéricos");
      return;
    }
    const { error } = await supabase
      .from("config_lojas")
      .update({ pin_contagem: pinValue || null } as any)
      .eq("id", effectiveUnidadeId);
    if (error) {
      toast.error("Erro ao salvar PIN");
    } else {
      toast.success(pinValue ? "PIN salvo!" : "PIN removido");
    }
  };

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
      initialSec[si.catalog_item_id] = si.area_responsavel || "Front";
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
        area_responsavel: sectors[catalogId] || "Front",
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
          <Button onClick={handleOpenDialog} variant={hasStoreConfig ? "outline" : "default"} className={isMobile ? "w-full" : ""}>
            <Settings2 className="h-4 w-4 mr-2" />
            {hasStoreConfig ? "Ajustar Estoques Mínimos" : "Definir Estoque Inicial"}
          </Button>
        </div>
      </div>

      {/* Link de Contagem section */}
      {canManageLinks && effectiveUnidadeId && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Link de Contagem</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Compartilhe este link para que a equipe faça a contagem de utensílios sem precisar acessar o portal.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <Input value={countingLink} readOnly className="text-xs font-mono flex-1" />
              <Button size="sm" variant="outline" onClick={handleCopyLink}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleShareWhatsApp}>
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <Lock className="h-3 w-3" /> PIN de acesso (4 dígitos)
                </Label>
                <Input
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Ex: 1234"
                  maxLength={4}
                  className="w-32 font-mono"
                />
              </div>
              <Button size="sm" onClick={handleSavePin}>
                <Save className="h-3.5 w-3.5 mr-1" /> Salvar PIN
              </Button>
            </div>
            {!pinValue && (
              <p className="text-xs text-amber-600 mt-2">⚠️ Sem PIN definido — qualquer pessoa com o link poderá acessar.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gestão em Massa — admin only */}
      {isAdmin && (
        <Card>
          <CardContent className="p-4">
            <div className={isMobile ? "space-y-3" : "flex items-center justify-between gap-4"}>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Network className="h-4 w-4 text-primary" />
                  Gestão de Estoques Mínimos da Rede
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Edite os mínimos de todas as unidades em uma matriz visual, ou use a planilha para importação em massa.
                </p>
              </div>
              <div className={isMobile ? "flex flex-col gap-2 w-full" : "flex items-center gap-2 shrink-0 flex-wrap"}>
                <Button
                  onClick={() => setPdfImportOpen(true)}
                  variant="default"
                  className={isMobile ? "w-full" : ""}
                >
                  <FileUp className="h-4 w-4 mr-2" />
                  Importar PDF (IA)
                </Button>
                <Button
                  onClick={() => setMatrixOpen(true)}
                  variant="outline"
                  className={isMobile ? "w-full" : ""}
                >
                  <Network className="h-4 w-4 mr-2" />
                  Editar Matriz da Rede
                </Button>
                <BulkImportExport />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className={isMobile ? "overflow-x-auto -mx-2 px-2" : ""}>
          <TabsList className={isMobile ? "inline-flex w-auto min-w-full" : "grid w-full grid-cols-5"}>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="contagem">{isMobile ? "Contagem" : "Contagem Semanal"}</TabsTrigger>
            <TabsTrigger value="budget">{isMobile ? "Compras" : "Controle de Compras"}</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="fotos">Fotos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard"><DashboardUtensilios /></TabsContent>
        <TabsContent value="contagem"><ContagemSemanal /></TabsContent>
        <TabsContent value="budget"><ControleBudget /></TabsContent>
        <TabsContent value="historico"><HistoricoContagens /></TabsContent>
        <TabsContent value="fotos"><GaleriaFotos /></TabsContent>
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
                  const sec = sectors[item.id] ?? existing?.area_responsavel ?? "Front";
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

      {/* Matriz Global Loja x Item — admin only */}
      {isAdmin && (
        <GlobalMinimumStockMatrix open={matrixOpen} onOpenChange={setMatrixOpen} />
      )}

      {/* PDF Import (IA) — admin only */}
      {isAdmin && (
        <UtensiliosImportPDFDialog open={pdfImportOpen} onOpenChange={setPdfImportOpen} />
      )}
    </div>
  );
}
