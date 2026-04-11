import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUtensiliosItems, useUtensiliosSemanas, useUtensiliosContagens } from "@/hooks/useUtensilios";
import { Skeleton } from "@/components/ui/skeleton";

export function HistoricoContagens() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: items } = useUtensiliosItems(effectiveUnidadeId);
  const { data: semanas, isLoading } = useUtensiliosSemanas(effectiveUnidadeId);
  const [selectedSemana, setSelectedSemana] = useState<string>("");
  const { data: contagens } = useUtensiliosContagens(selectedSemana || null);

  const tableData = useMemo(() => {
    if (!items || !contagens) return [];
    const countMap: Record<string, { abertura?: number; fechamento?: number }> = {};
    contagens.forEach((c: any) => {
      if (!countMap[c.utensilio_item_id]) countMap[c.utensilio_item_id] = {};
      if (c.turno === "ABERTURA") countMap[c.utensilio_item_id].abertura = c.quantidade_contada;
      if (c.turno === "FECHAMENTO") countMap[c.utensilio_item_id].fechamento = c.quantidade_contada;
    });

    return items.map((item: any) => {
      const counts = countMap[item.id] || {};
      const min = item.estoque_minimo || 0;
      const variacao = counts.abertura != null && counts.fechamento != null
        ? counts.fechamento - counts.abertura
        : null;
      const belowMin = (counts.abertura != null && counts.abertura < min) ||
                       (counts.fechamento != null && counts.fechamento < min);
      return {
        ...item,
        abertura: counts.abertura,
        fechamento: counts.fechamento,
        variacao,
        belowMin,
        min,
      };
    });
  }, [items, contagens]);

  if (!effectiveUnidadeId) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  }

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label>Semana de Referência</Label>
          <Select value={selectedSemana} onValueChange={setSelectedSemana}>
            <SelectTrigger><SelectValue placeholder="Selecionar semana" /></SelectTrigger>
            <SelectContent>
              {semanas?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.semana_label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Abertura</TableHead>
                <TableHead className="text-right">Fechamento</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!selectedSemana ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Selecione uma semana.</TableCell></TableRow>
              ) : tableData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum item encontrado.</TableCell></TableRow>
              ) : (
                tableData.map((item: any) => (
                  <TableRow key={item.id} className={item.belowMin ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium">{item.items_catalog?.name || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{item.min}</TableCell>
                    <TableCell className={`text-right font-mono ${item.abertura != null && item.abertura < item.min ? "text-destructive font-bold" : ""}`}>
                      {item.abertura ?? "—"}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${item.fechamento != null && item.fechamento < item.min ? "text-destructive font-bold" : ""}`}>
                      {item.fechamento ?? "—"}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${item.variacao != null && item.variacao < 0 ? "text-destructive" : item.variacao != null && item.variacao > 0 ? "text-green-600" : ""}`}>
                      {item.variacao != null ? (item.variacao > 0 ? `+${item.variacao}` : item.variacao) : "—"}
                    </TableCell>
                    <TableCell>
                      {item.belowMin ? (
                        <Badge variant="destructive" className="text-xs">Abaixo</Badge>
                      ) : (
                        <Badge className="bg-green-600 text-xs">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
