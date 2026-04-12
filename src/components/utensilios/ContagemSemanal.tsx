import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUtensiliosCatalog, useUtensiliosItems, useDistinctSemanas, useUtensiliosContagens, useSaveContagem } from "@/hooks/useUtensilios";
import { SectorFilter } from "./SectorFilter";
import { Save, CheckCircle, AlertTriangle, MinusCircle, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

export function ContagemSemanal() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: catalog, isLoading: loadingCatalog } = useUtensiliosCatalog();
  const { data: storeItems } = useUtensiliosItems(effectiveUnidadeId);
  const { data: semanas, isLoading: loadingSemanas } = useDistinctSemanas(effectiveUnidadeId);
  const saveContagem = useSaveContagem();
  const isMobile = useIsMobile();

  const [semanaRef, setSemanaRef] = useState("");
  const [newSemanaRef, setNewSemanaRef] = useState("");
  const [turno, setTurno] = useState("ABERTURA");
  const [setor, setSetor] = useState("Todos");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");

  const activeSemana = semanaRef || "";
  const { data: contagens } = useUtensiliosContagens(effectiveUnidadeId, activeSemana || null);

  const storeMap = useMemo(() => {
    const map: Record<string, any> = {};
    storeItems?.forEach((si: any) => { map[si.catalog_item_id] = si; });
    return map;
  }, [storeItems]);

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
      .map((c: any) => {
        const storeItem = storeMap[c.id];
        return {
          catalogId: c.id,
          storeItemId: storeItem?.id || null,
          name: c.name,
          code: c.code,
          unit: c.unit || "UN",
          setor: storeItem?.area_responsavel || "Salão",
          estoque_minimo: storeItem?.estoque_minimo ?? null,
          preco_custo: c.preco_custo || 0,
        };
      })
      .filter((i) => setor === "Todos" || i.setor === setor);
  }, [catalog, storeMap, search, setor]);

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar utensílio..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {displayItems.length > 0 ? (
        isMobile ? (
          <div className="space-y-2">
            {displayItems.map((item) => {
              const existingQty = item.storeItemId ? existingCounts[item.storeItemId] : undefined;
              const qty = counts[item.catalogId] ?? existingQty ?? "";
              return (
                <Card key={item.catalogId}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{item.setor}</Badge>
                          <span className="text-xs text-muted-foreground">{item.code} · {item.unit}</span>
                          {item.estoque_minimo !== null && <span className="text-xs text-muted-foreground">Mín: {item.estoque_minimo}</span>}
                        </div>
                      </div>
                      {getStatusBadge(qty, item.estoque_minimo)}
                    </div>
                    <Input
                      type="number" min={0} placeholder="Qtd contada" value={qty} disabled={!item.storeItemId}
                      onChange={(e) => setCounts(prev => ({ ...prev, [item.catalogId]: parseInt(e.target.value) || 0 }))}
                    />
                    {!item.storeItemId && <p className="text-[10px] text-muted-foreground">Configure o estoque mínimo primeiro</p>}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.map((item) => {
                    const existingQty = item.storeItemId ? existingCounts[item.storeItemId] : undefined;
                    const qty = counts[item.catalogId] ?? existingQty ?? "";
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
                            type="number" min={0} className="w-20 ml-auto text-right" value={qty} disabled={!item.storeItemId}
                            onChange={(e) => setCounts(prev => ({ ...prev, [item.catalogId]: parseInt(e.target.value) || 0 }))}
                          />
                        </TableCell>
                        <TableCell>{getStatusBadge(qty, item.estoque_minimo)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      ) : (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum utensílio encontrado.</CardContent></Card>
      )}
    </div>
  );
}
