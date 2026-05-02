import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUnidade } from "@/contexts/UnidadeContext";
import {
  useUtensiliosCatalog,
  useUtensiliosItems,
  useDistinctSemanas,
  useUtensiliosContagens,
  useSaveContagem,
  useHiddenUtensiliosItems,
  useToggleUtensilioVisibility,
} from "@/hooks/useUtensilios";
import { SectorFilter } from "./SectorFilter";
import { Save, CheckCircle, AlertTriangle, MinusCircle, Search, EyeOff, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

export function ContagemSemanal() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: catalog, isLoading: loadingCatalog } = useUtensiliosCatalog();
  const { data: storeItems } = useUtensiliosItems(effectiveUnidadeId);
  const { data: hiddenItems } = useHiddenUtensiliosItems(effectiveUnidadeId);
  const { data: semanas, isLoading: loadingSemanas } = useDistinctSemanas(effectiveUnidadeId);
  const saveContagem = useSaveContagem();
  const toggleVisibility = useToggleUtensilioVisibility();
  const isMobile = useIsMobile();

  const [semanaRef, setSemanaRef] = useState("");
  const [newSemanaRef, setNewSemanaRef] = useState("");
  const [turno, setTurno] = useState("ABERTURA");
  const [setor, setSetor] = useState("Todos");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [showUnconfigured, setShowUnconfigured] = useState(false);

  const activeSemana = semanaRef || "";
  const { data: contagens } = useUtensiliosContagens(effectiveUnidadeId, activeSemana || null);

  const storeMap = useMemo(() => {
    const map: Record<string, any> = {};
    storeItems?.forEach((si: any) => { map[si.catalog_item_id] = si; });
    return map;
  }, [storeItems]);

  const hiddenSet = useMemo(() => {
    const set = new Set<string>();
    hiddenItems?.forEach((h: any) => set.add(h.catalog_item_id));
    return set;
  }, [hiddenItems]);

  const existingCounts = useMemo(() => {
    const map: Record<string, number> = {};
    contagens?.forEach((c: any) => {
      if (c.turno === turno) map[c.utensilio_item_id] = c.quantidade_contada;
    });
    return map;
  }, [contagens, turno]);

  const displayItems = useMemo(() => {
    if (!catalog) return [];
    const q = search.toLowerCase();
    return catalog
      .filter((c: any) => c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q))
      .filter((c: any) => showHidden ? hiddenSet.has(c.id) : !hiddenSet.has(c.id))
      // Only show items linked to this store (configured) unless user opts in
      .filter((c: any) => {
        if (showHidden || showUnconfigured) return true;
        const si = storeMap[c.id];
        return si && (si.estoque_minimo ?? 0) > 0;
      })
      .map((c: any) => {
        const storeItem = storeMap[c.id];
        return {
          catalogId: c.id,
          storeItemId: storeItem?.id || null,
          name: c.name,
          code: c.code,
          unit: c.unit || "UN",
          setor: storeItem?.area_responsavel || "Front",
          estoque_minimo: storeItem?.estoque_minimo ?? null,
          preco_custo: c.preco_custo || 0,
        };
      })
      .filter((i) => setor === "Todos" || i.setor === setor);
  }, [catalog, storeMap, search, setor, showHidden, hiddenSet, showUnconfigured]);

  const configuredCount = useMemo(
    () => (storeItems || []).filter((si: any) => (si.estoque_minimo ?? 0) > 0).length,
    [storeItems]
  );
  const catalogTotal = catalog?.length || 0;

  const handleToggleHide = (catalogId: string, hide: boolean) => {
    if (!effectiveUnidadeId) return;
    const storeItem = storeMap[catalogId];
    toggleVisibility.mutate({
      catalog_item_id: catalogId,
      loja_id: effectiveUnidadeId,
      is_active: !hide,
      estoque_minimo: storeItem?.estoque_minimo ?? 0,
      area_responsavel: storeItem?.area_responsavel || "Front",
    });
  };

  const handleSave = () => {
    if (!effectiveUnidadeId) return;
    const ref = activeSemana || newSemanaRef;
    if (!ref) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const entries = Object.entries(counts)
      .filter(([, v]) => v >= 0)
      .map(([catalogId, qty]) => {
        const item = displayItems.find(d => d.catalogId === catalogId);
        if (!item?.storeItemId) return null;
        return {
          loja_id: effectiveUnidadeId,
          utensilio_item_id: item.storeItemId,
          turno,
          quantidade_contada: qty,
          data_contagem: today,
          semana_referencia: ref,
        };
      })
      .filter(Boolean) as any[];
    if (entries.length) {
      saveContagem.mutate(entries, {
        onSuccess: () => {
          setCounts({});
          if (newSemanaRef) { setSemanaRef(newSemanaRef); setNewSemanaRef(""); }
        },
      });
    }
  };

  if (!effectiveUnidadeId) return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  if (loadingCatalog || loadingSemanas) return <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  const getStatusBadge = (qty: number | "", min: number | null) => {
    const numQty = typeof qty === "number" ? qty : 0;
    if (min === null) return <Badge variant="outline" className="text-[10px]"><MinusCircle className="h-3 w-3 mr-1" />Sem mínimo</Badge>;
    if (numQty <= 0) return <span className="text-xs text-muted-foreground">—</span>;
    if (numQty < min) return <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Abaixo</Badge>;
    return <Badge className="bg-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>;
  };

  const hiddenCount = hiddenItems?.length || 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className={isMobile ? "space-y-3" : "flex flex-wrap gap-3 items-end"}>
        <div className={isMobile ? "w-full" : "flex-1 min-w-[180px]"}>
          <Label>Semana de Referência</Label>
          {semanas && semanas.length > 0 ? (
            <Select value={semanaRef} onValueChange={setSemanaRef}>
              <SelectTrigger><SelectValue placeholder="Selecionar semana" /></SelectTrigger>
              <SelectContent>{semanas.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
        </div>
        <div className={isMobile ? "grid grid-cols-3 gap-2" : "flex gap-3 items-end"}>
          <div>
            <Label>Nova Semana</Label>
            <Input value={newSemanaRef} onChange={(e) => setNewSemanaRef(e.target.value)} placeholder="2026-S15" />
          </div>
          <div>
            <Label>Turno</Label>
            <Select value={turno} onValueChange={setTurno}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ABERTURA">Abertura</SelectItem>
                <SelectItem value="FECHAMENTO">Fechamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SectorFilter value={setor} onChange={setSetor} />
        </div>
        <Button onClick={handleSave} disabled={(!activeSemana && !newSemanaRef) || saveContagem.isPending} className={isMobile ? "w-full" : ""}>
          <Save className="h-4 w-4 mr-1" />Salvar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar utensílio..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30">
          <Switch id="show-unconfigured" checked={showUnconfigured} onCheckedChange={setShowUnconfigured} disabled={showHidden} />
          <Label htmlFor="show-unconfigured" className="text-xs cursor-pointer">
            Mostrar não configurados
            <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">{configuredCount}/{catalogTotal}</Badge>
          </Label>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30">
          <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
          <Label htmlFor="show-hidden" className="text-xs cursor-pointer flex items-center gap-1">
            <EyeOff className="h-3.5 w-3.5" />
            Ocultos {hiddenCount > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">{hiddenCount}</Badge>}
          </Label>
        </div>
      </div>

      {displayItems.length > 0 ? (
        isMobile ? (
          <div className="space-y-2">
            {displayItems.map((item) => {
              const existingQty = item.storeItemId ? existingCounts[item.storeItemId] : undefined;
              const qty = counts[item.catalogId] ?? existingQty ?? "";
              const isHidden = hiddenSet.has(item.catalogId);
              return (
                <Card key={item.catalogId}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{item.setor}</Badge>
                          <span className="text-xs text-muted-foreground">{item.code} · {item.unit}</span>
                          {item.estoque_minimo !== null && <span className="text-xs text-muted-foreground">Mín: {item.estoque_minimo}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {getStatusBadge(qty, item.estoque_minimo)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={isHidden ? "Reexibir item" : "Ocultar item desta loja"}
                          disabled={toggleVisibility.isPending}
                          onClick={() => handleToggleHide(item.catalogId, !isHidden)}
                        >
                          {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                    {!isHidden && (
                      <Input
                        type="number" min={0} placeholder="Qtd contada" value={qty} disabled={!item.storeItemId}
                        onChange={(e) => setCounts(prev => ({ ...prev, [item.catalogId]: parseInt(e.target.value) || 0 }))}
                      />
                    )}
                    {!item.storeItemId && !isHidden && <p className="text-[10px] text-muted-foreground">Configure o estoque mínimo primeiro</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">Contagem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.map((item) => {
                    const existingQty = item.storeItemId ? existingCounts[item.storeItemId] : undefined;
                    const qty = counts[item.catalogId] ?? existingQty ?? "";
                    const isHidden = hiddenSet.has(item.catalogId);
                    return (
                      <TableRow key={item.catalogId}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{item.setor}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.code}</TableCell>
                        <TableCell className="text-right font-mono">
                          {item.estoque_minimo !== null ? item.estoque_minimo : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number" min={0} className="w-20 ml-auto text-right" value={qty} disabled={!item.storeItemId || isHidden}
                            onChange={(e) => setCounts(prev => ({ ...prev, [item.catalogId]: parseInt(e.target.value) || 0 }))}
                          />
                        </TableCell>
                        <TableCell>{getStatusBadge(qty, item.estoque_minimo)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={isHidden ? "Reexibir item" : "Ocultar item desta loja"}
                            disabled={toggleVisibility.isPending}
                            onClick={() => handleToggleHide(item.catalogId, !isHidden)}
                          >
                            {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      ) : (
        <Card><CardContent className="py-10 text-center text-muted-foreground space-y-2">
          {showHidden ? (
            <p>Nenhum item oculto.</p>
          ) : configuredCount === 0 ? (
            <>
              <p className="font-medium text-foreground">Nenhum utensílio configurado nesta loja.</p>
              <p className="text-xs">Use "Importar PDF (IA)" ou "Definir Estoque Inicial" para começar.</p>
              <p className="text-xs">Ou ative "Mostrar não configurados" para ver o catálogo completo ({catalogTotal} itens).</p>
            </>
          ) : (
            <p>Nenhum utensílio encontrado com esses filtros.</p>
          )}
        </CardContent></Card>
      )}
    </div>
  );
}
