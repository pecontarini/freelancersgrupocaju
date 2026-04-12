import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUtensiliosCatalog, useUtensiliosItems, useSaveContagem } from "@/hooks/useUtensilios";
import { SectorFilter, SETORES_UTENSILIOS } from "@/components/utensilios/SectorFilter";
import { Save, Search, CheckCircle, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useUnidade } from "@/contexts/UnidadeContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export default function ContagemUtensilios() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: catalog, isLoading: loadingCatalog } = useUtensiliosCatalog();
  const { data: storeItems } = useUtensiliosItems(effectiveUnidadeId);
  const saveContagem = useSaveContagem();

  const [semanaRef, setSemanaRef] = useState("");
  const [turno, setTurno] = useState("ABERTURA");
  const [setor, setSetor] = useState("Todos");
  const [responsavel, setResponsavel] = useState("");
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const storeMap = useMemo(() => {
    const map: Record<string, any> = {};
    storeItems?.forEach((si: any) => { map[si.catalog_item_id] = si; });
    return map;
  }, [storeItems]);

  const displayItems = useMemo(() => {
    if (!catalog) return [];
    const q = search.toLowerCase();
    return catalog
      .filter((c: any) => {
        if (!c.name?.toLowerCase().includes(q) && !c.code?.toLowerCase().includes(q)) return false;
        const storeItem = storeMap[c.id];
        if (!storeItem) return false; // Only show configured items
        if (setor !== "Todos" && storeItem.area_responsavel !== setor) return false;
        return true;
      })
      .map((c: any) => {
        const si = storeMap[c.id];
        return {
          catalogId: c.id,
          storeItemId: si.id,
          name: c.name,
          code: c.code,
          unit: c.unit || "UN",
          setor: si.area_responsavel || "Salão",
          estoque_minimo: si.estoque_minimo ?? 0,
          photo_url: c.photo_url || null,
        };
      });
  }, [catalog, storeMap, search, setor]);

  const filledCount = Object.values(counts).filter(v => v > 0).length;

  const handleSave = () => {
    if (!effectiveUnidadeId || !semanaRef) { toast.error("Preencha a semana"); return; }
    if (!responsavel.trim()) { toast.error("Informe o nome do responsável"); return; }
    const today = format(new Date(), "yyyy-MM-dd");
    const entries = Object.entries(counts)
      .filter(([, v]) => v >= 0)
      .map(([catalogId, qty]) => {
        const item = displayItems.find(d => d.catalogId === catalogId);
        if (!item) return null;
        return {
          loja_id: effectiveUnidadeId,
          utensilio_item_id: item.storeItemId,
          turno,
          quantidade_contada: qty,
          data_contagem: today,
          semana_referencia: semanaRef,
          responsavel: responsavel.trim(),
        };
      })
      .filter(Boolean) as any[];

    if (entries.length === 0) { toast.error("Preencha ao menos um item"); return; }
    saveContagem.mutate(entries, {
      onSuccess: () => setCounts({}),
    });
  };

  if (!effectiveUnidadeId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade no portal.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Contagem de Utensílios</h1>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Semana</Label>
              <Input value={semanaRef} onChange={(e) => setSemanaRef(e.target.value)} placeholder="2026-S15" />
            </div>
            <div>
              <Label className="text-xs">Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABERTURA">Abertura</SelectItem>
                  <SelectItem value="FECHAMENTO">Fechamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <SectorFilter value={setor} onChange={setSetor} />
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Seu nome" />
            </div>
          </div>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar utensílio..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="max-w-2xl mx-auto p-4 pb-24">
        {loadingCatalog ? (
          <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : displayItems.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            {storeItems?.length === 0 ? "Nenhum utensílio configurado nesta loja. Defina o estoque mínimo primeiro." : "Nenhum item encontrado."}
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {displayItems.map((item) => {
              const qty = counts[item.catalogId] ?? "";
              return (
                <Card key={item.catalogId} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.name} className="w-12 h-12 rounded-md object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{item.setor}</Badge>
                          <span className="text-[10px] text-muted-foreground">Mín: {item.estoque_minimo}</span>
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        className="w-20 text-right text-lg font-mono"
                        placeholder="0"
                        value={qty}
                        onChange={(e) => setCounts(prev => ({ ...prev, [item.catalogId]: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed bottom save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-20">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">{filledCount} itens preenchidos</p>
            <p className="text-xs text-muted-foreground">{displayItems.length} itens no total</p>
          </div>
          <Button onClick={handleSave} disabled={saveContagem.isPending || filledCount === 0} size="lg">
            {saveContagem.isPending ? "Salvando..." : (
              <><Save className="h-4 w-4 mr-2" />Salvar Contagem</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
