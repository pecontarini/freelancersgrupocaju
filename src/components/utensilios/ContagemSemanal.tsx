import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUtensiliosItems, useUtensiliosSemanas, useUtensiliosContagens, useCreateSemana, useSaveContagem } from "@/hooks/useUtensilios";
import { Plus, Save, CheckCircle, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ContagemSemanal() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: items, isLoading: loadingItems } = useUtensiliosItems(effectiveUnidadeId);
  const { data: semanas, isLoading: loadingSemanas } = useUtensiliosSemanas(effectiveUnidadeId);
  const createSemana = useCreateSemana();
  const saveContagem = useSaveContagem();

  const [selectedSemana, setSelectedSemana] = useState<string>("");
  const [turno, setTurno] = useState<string>("ABERTURA");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [newWeekOpen, setNewWeekOpen] = useState(false);

  const { data: contagens } = useUtensiliosContagens(selectedSemana || null);

  const existingCounts = useMemo(() => {
    const map: Record<string, number> = {};
    contagens?.forEach((c: any) => {
      if (c.turno === turno) {
        map[c.utensilio_item_id] = c.quantidade_contada;
      }
    });
    return map;
  }, [contagens, turno]);

  const handleCreateWeek = () => {
    if (!effectiveUnidadeId) return;
    const now = new Date();
    const inicio = startOfWeek(now, { weekStartsOn: 1 });
    const fim = endOfWeek(now, { weekStartsOn: 1 });
    const label = `Sem ${format(inicio, "dd/MM")} - ${format(fim, "dd/MM/yyyy")}`;
    createSemana.mutate({
      loja_id: effectiveUnidadeId,
      data_inicio: format(inicio, "yyyy-MM-dd"),
      data_fim: format(fim, "yyyy-MM-dd"),
      semana_label: label,
    }, {
      onSuccess: (data) => {
        setSelectedSemana(data.id);
        setNewWeekOpen(false);
      },
    });
  };

  const handleSave = () => {
    if (!selectedSemana || !items) return;
    const entries = Object.entries(counts)
      .filter(([, v]) => v >= 0)
      .map(([itemId, qty]) => ({
        semana_id: selectedSemana,
        utensilio_item_id: itemId,
        turno,
        quantidade_contada: qty,
      }));
    if (entries.length) saveContagem.mutate(entries);
  };

  if (!effectiveUnidadeId) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  }

  if (loadingItems || loadingSemanas) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label>Semana</Label>
          <Select value={selectedSemana} onValueChange={setSelectedSemana}>
            <SelectTrigger><SelectValue placeholder="Selecionar semana" /></SelectTrigger>
            <SelectContent>
              {semanas?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.semana_label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Turno</Label>
          <Select value={turno} onValueChange={setTurno}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ABERTURA">Abertura</SelectItem>
              <SelectItem value="FECHAMENTO">Fechamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => setNewWeekOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Nova Semana
        </Button>
        <Button onClick={handleSave} disabled={!selectedSemana || saveContagem.isPending}>
          <Save className="h-4 w-4 mr-1" />Salvar
        </Button>
      </div>

      {selectedSemana && items && items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Contagem</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
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
                        <Input
                          type="number"
                          min={0}
                          className="w-20 ml-auto text-right"
                          value={qty}
                          onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                        />
                      </TableCell>
                      <TableCell>
                        {numQty > 0 ? (
                          isBelow ? (
                            <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Abaixo</Badge>
                          ) : (
                            <Badge className="bg-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          {!selectedSemana ? "Selecione ou crie uma semana para iniciar a contagem." : "Nenhum item de utensílio configurado para esta unidade."}
        </CardContent></Card>
      )}

      <Dialog open={newWeekOpen} onOpenChange={setNewWeekOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Nova Semana</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Será criada a semana atual ({format(startOfWeek(new Date(), { weekStartsOn: 1 }), "dd/MM", { locale: ptBR })} - {format(endOfWeek(new Date(), { weekStartsOn: 1 }), "dd/MM/yyyy", { locale: ptBR })}).
          </p>
          <Button onClick={handleCreateWeek} disabled={createSemana.isPending} className="w-full mt-2">
            Criar Semana
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
