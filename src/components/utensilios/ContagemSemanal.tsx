import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUtensiliosItems, useDistinctSemanas, useUtensiliosContagens, useSaveContagem } from "@/hooks/useUtensilios";
import { Save, CheckCircle, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

export function ContagemSemanal() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: items, isLoading: loadingItems } = useUtensiliosItems(effectiveUnidadeId);
  const { data: semanas, isLoading: loadingSemanas } = useDistinctSemanas(effectiveUnidadeId);
  const saveContagem = useSaveContagem();
  const isMobile = useIsMobile();

  const [semanaRef, setSemanaRef] = useState<string>("");
  const [newSemanaRef, setNewSemanaRef] = useState<string>("");
  const [turno, setTurno] = useState<string>("ABERTURA");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const activeSemana = semanaRef || "";
  const { data: contagens } = useUtensiliosContagens(effectiveUnidadeId, activeSemana || null);

  const existingCounts = useMemo(() => {
    const map: Record<string, number> = {};
    contagens?.forEach((c: any) => {
      if (c.turno === turno) map[c.utensilio_item_id] = c.quantidade_contada;
    });
    return map;
  }, [contagens, turno]);

  const handleSave = () => {
    if (!effectiveUnidadeId || !items) return;
    const ref = activeSemana || newSemanaRef;
    if (!ref) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const entries = Object.entries(counts).filter(([, v]) => v >= 0).map(([itemId, qty]) => ({
      loja_id: effectiveUnidadeId, utensilio_item_id: itemId, turno,
      quantidade_contada: qty, data_contagem: today, semana_referencia: ref,
    }));
    if (entries.length) {
      saveContagem.mutate(entries, {
        onSuccess: () => { setCounts({}); if (newSemanaRef) { setSemanaRef(newSemanaRef); setNewSemanaRef(""); } },
      });
    }
  };

  if (!effectiveUnidadeId) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  }

  if (loadingItems || loadingSemanas) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className={isMobile ? "space-y-3" : "flex flex-wrap gap-3 items-end"}>
        <div className={isMobile ? "w-full" : "flex-1 min-w-[200px]"}>
          <Label>Semana de Referência</Label>
          {semanas && semanas.length > 0 ? (
            <Select value={semanaRef} onValueChange={setSemanaRef}>
              <SelectTrigger><SelectValue placeholder="Selecionar semana" /></SelectTrigger>
              <SelectContent>{semanas.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
        </div>
        <div className={isMobile ? "grid grid-cols-2 gap-2" : "flex gap-3 items-end"}>
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
        </div>
        <Button onClick={handleSave} disabled={(!activeSemana && !newSemanaRef) || saveContagem.isPending} className={isMobile ? "w-full" : ""}>
          <Save className="h-4 w-4 mr-1" />Salvar
        </Button>
      </div>

      {items && items.length > 0 ? (
        isMobile ? (
          <div className="space-y-2">
            {items.map((item: any) => {
              const qty = counts[item.id] ?? existingCounts[item.id] ?? "";
              const min = item.estoque_minimo || 0;
              const numQty = typeof qty === "number" ? qty : parseInt(String(qty)) || 0;
              const isBelow = numQty > 0 && numQty < min;
              return (
                <Card key={item.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.items_catalog?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{item.items_catalog?.code} · Mín: {min}</p>
                      </div>
                      {numQty > 0 ? (
                        isBelow ? <Badge variant="destructive" className="text-xs shrink-0"><AlertTriangle className="h-3 w-3 mr-1" />Abaixo</Badge>
                          : <Badge className="bg-green-600 text-xs shrink-0"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                    <Input type="number" min={0} placeholder="Qtd contada" value={qty}
                      onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Item</TableHead><TableHead>Código</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead><TableHead className="text-right">Contagem</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {items.map((item: any) => {
                    const qty = counts[item.id] ?? existingCounts[item.id] ?? "";
                    const min = item.estoque_minimo || 0;
                    const numQty = typeof qty === "number" ? qty : parseInt(String(qty)) || 0;
                    const isBelow = numQty > 0 && numQty < min;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.items_catalog?.name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.items_catalog?.code}</TableCell>
                        <TableCell className="text-right font-mono">{min}</TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min={0} className="w-20 ml-auto text-right" value={qty}
                            onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))} />
                        </TableCell>
                        <TableCell>
                          {numQty > 0 ? (
                            isBelow ? <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Abaixo</Badge>
                              : <Badge className="bg-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
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
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum item de utensílio configurado para esta unidade.</CardContent></Card>
      )}
    </div>
  );
}
