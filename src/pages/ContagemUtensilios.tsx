import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUtensiliosCatalog, useUtensiliosItems, useSaveContagem, useAutoProvisionItems, useUpdateUtensilioItem } from "@/hooks/useUtensilios";
import { SectorFilter } from "@/components/utensilios/SectorFilter";
import { Save, Search, Package, Lock, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function PinScreen({ lojaId, onSuccess }: { lojaId: string; onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    supabase
      .from("config_lojas")
      .select("nome")
      .eq("id", lojaId)
      .single()
      .then(({ data }) => {
        if (data) setStoreName(data.nome);
      });
  }, [lojaId]);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const { data } = await supabase
      .from("config_lojas")
      .select("pin_contagem")
      .eq("id", lojaId)
      .single();

    const storePin = (data as any)?.pin_contagem;
    if (!storePin) {
      onSuccess();
    } else if (pin === storePin) {
      onSuccess();
    } else {
      setError("PIN incorreto");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="text-center">
            <Lock className="h-10 w-10 mx-auto text-primary mb-2" />
            <h1 className="text-lg font-bold">Contagem de Utensílios</h1>
            {storeName && <p className="text-sm text-muted-foreground">{storeName}</p>}
          </div>
          <div>
            <Label className="text-sm">Digite o PIN de acesso</Label>
            <Input
              type="tel"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="• • • •"
              className="text-center text-2xl font-mono tracking-[0.5em] mt-1"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
          <Button onClick={handleSubmit} disabled={loading || pin.length < 4} className="w-full">
            {loading ? "Verificando..." : "Acessar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ContagemUtensilios() {
  const { lojaId: paramLojaId } = useParams<{ lojaId?: string }>();
  const { effectiveUnidadeId } = useUnidade();
  const resolvedLojaId = paramLojaId || effectiveUnidadeId;

  const [pinAuthenticated, setPinAuthenticated] = useState(false);
  const isPublicAccess = !!paramLojaId;

  if (isPublicAccess && !pinAuthenticated) {
    return <PinScreen lojaId={paramLojaId!} onSuccess={() => setPinAuthenticated(true)} />;
  }

  if (!resolvedLojaId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade no portal.</CardContent></Card>
      </div>
    );
  }

  return <ContagemForm lojaId={resolvedLojaId} />;
}

function ContagemForm({ lojaId }: { lojaId: string }) {
  const { data: catalog, isLoading: loadingCatalog } = useUtensiliosCatalog();
  const { data: storeItems, isLoading: loadingItems } = useUtensiliosItems(lojaId);
  const saveContagem = useSaveContagem();
  const autoProvision = useAutoProvisionItems();
  const updateItem = useUpdateUtensilioItem();
  const provisionTriggered = useRef(false);

  const [semanaRef, setSemanaRef] = useState("");
  const [turno, setTurno] = useState("ABERTURA");
  const [setor, setSetor] = useState("Todos");
  const [responsavel, setResponsavel] = useState("");
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Auto-provision: if store has no items and catalog is loaded, create them
  useEffect(() => {
    if (
      !provisionTriggered.current &&
      !loadingCatalog &&
      !loadingItems &&
      catalog &&
      catalog.length > 0 &&
      storeItems &&
      storeItems.length === 0
    ) {
      provisionTriggered.current = true;
      autoProvision.mutate(lojaId);
    }
  }, [loadingCatalog, loadingItems, catalog, storeItems, lojaId]);

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
        if (!storeItem) return false;
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
          setor: si.area_responsavel || "Front",
          estoque_minimo: si.estoque_minimo ?? 0,
          photo_url: c.photo_url || null,
        };
      });
  }, [catalog, storeMap, search, setor]);

  const filledCount = Object.values(counts).filter(v => v > 0).length;

  const handleToggleSetor = (storeItemId: string, currentSetor: string) => {
    const newSetor = currentSetor === "Front" ? "Back" : "Front";
    updateItem.mutate({ id: storeItemId, area_responsavel: newSetor } as any);
  };

  const handleSave = () => {
    if (!lojaId || !semanaRef) { toast.error("Preencha a semana"); return; }
    if (!responsavel.trim()) { toast.error("Informe o nome do responsável"); return; }
    const today = format(new Date(), "yyyy-MM-dd");
    const entries = Object.entries(counts)
      .filter(([, v]) => v >= 0)
      .map(([catalogId, qty]) => {
        const item = displayItems.find(d => d.catalogId === catalogId);
        if (!item) return null;
        return {
          loja_id: lojaId,
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

  const isProvisioning = autoProvision.isPending;

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
        {(loadingCatalog || loadingItems || isProvisioning) ? (
          <div className="space-y-2">
            {isProvisioning && (
              <div className="flex items-center gap-2 justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparando itens para contagem...
              </div>
            )}
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : displayItems.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            Nenhum item encontrado.
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
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-5 px-1.5 text-[10px] font-bold ${item.setor === "Front" ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-red-100 text-red-700 border-red-300"}`}
                            onClick={() => handleToggleSetor(item.storeItemId, item.setor)}
                          >
                            {item.setor === "Front" ? "F" : "B"}
                          </Button>
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
