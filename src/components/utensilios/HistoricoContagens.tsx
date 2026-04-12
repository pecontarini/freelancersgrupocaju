import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUtensiliosItems, useDistinctSemanas, useUtensiliosContagens } from "@/hooks/useUtensilios";
import { SectorFilter } from "./SectorFilter";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

export function HistoricoContagens() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: items } = useUtensiliosItems(effectiveUnidadeId);
  const { data: semanas, isLoading } = useDistinctSemanas(effectiveUnidadeId);
  const [semanaRef, setSemanaRef] = useState("");
  const [setor, setSetor] = useState("Todos");
  const { data: contagens } = useUtensiliosContagens(effectiveUnidadeId, semanaRef || null);
  const isMobile = useIsMobile();

  const tableData = useMemo(() => {
    if (!items || !contagens) return [];
    const countMap: Record<string, { abertura?: number; fechamento?: number }> = {};
    contagens.forEach((c: any) => {
      if (!countMap[c.utensilio_item_id]) countMap[c.utensilio_item_id] = {};
      if (c.turno === "ABERTURA") countMap[c.utensilio_item_id].abertura = c.quantidade_contada;
      if (c.turno === "FECHAMENTO") countMap[c.utensilio_item_id].fechamento = c.quantidade_contada;
    });
    return items
      .filter((item: any) => setor === "Todos" || item.area_responsavel === setor)
      .map((item: any) => {
        const counts = countMap[item.id] || {};
        const min = item.estoque_minimo || 0;
        const variacao = counts.abertura != null && counts.fechamento != null ? counts.fechamento - counts.abertura : null;
        const belowMin = (counts.abertura != null && counts.abertura < min) || (counts.fechamento != null && counts.fechamento < min);
        return { ...item, abertura: counts.abertura, fechamento: counts.fechamento, variacao, belowMin, min };
      });
  }, [items, contagens, setor]);

  if (!effectiveUnidadeId) return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className={isMobile ? "space-y-3" : "flex items-end gap-3"}>
        <div className={isMobile ? "w-full" : "flex-1 min-w-[200px]"}>
          <Label>Semana de Referência</Label>
          <Select value={semanaRef} onValueChange={setSemanaRef}>
            <SelectTrigger><SelectValue placeholder="Selecionar semana" /></SelectTrigger>
            <SelectContent>{semanas?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <SectorFilter value={setor} onChange={setSetor} className={isMobile ? "w-full" : "min-w-[160px]"} />
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {!semanaRef ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Selecione uma semana.</CardContent></Card>
          ) : tableData.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum item encontrado.</CardContent></Card>
          ) : tableData.map((item: any) => (
            <Card key={item.id} className={item.belowMin ? "border-destructive/40" : ""}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{item.items_catalog?.name || "—"}</p>
                    <Badge variant="outline" className="text-[10px]">{item.area_responsavel || "Salão"}</Badge>
                  </div>
                  {item.belowMin ? <Badge variant="destructive" className="text-xs">Abaixo</Badge> : <Badge className="bg-green-600 text-xs">OK</Badge>}
                </div>
                <div className="grid grid-cols-4 gap-1 text-center bg-muted/30 rounded-md p-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Mín</p>
                    <p className="font-mono text-xs">{item.min}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Abert.</p>
                    <p className={`font-mono text-xs ${item.abertura != null && item.abertura < item.min ? "text-destructive font-bold" : ""}`}>
                      {item.abertura ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Fech.</p>
                    <p className={`font-mono text-xs ${item.fechamento != null && item.fechamento < item.min ? "text-destructive font-bold" : ""}`}>
                      {item.fechamento ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Var.</p>
                    <p className={`font-mono text-xs ${item.variacao != null && item.variacao < 0 ? "text-destructive" : item.variacao != null && item.variacao > 0 ? "text-green-600" : ""}`}>
                      {item.variacao != null ? (item.variacao > 0 ? `+${item.variacao}` : item.variacao) : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead>Setor</TableHead><TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Abertura</TableHead><TableHead className="text-right">Fechamento</TableHead>
              <TableHead className="text-right">Variação</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {!semanaRef ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Selecione uma semana.</TableCell></TableRow>
              ) : tableData.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum item encontrado.</TableCell></TableRow>
              ) : tableData.map((item: any) => (
                <TableRow key={item.id} className={item.belowMin ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium">{item.items_catalog?.name || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{item.area_responsavel || "Salão"}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{item.min}</TableCell>
                  <TableCell className={`text-right font-mono ${item.abertura != null && item.abertura < item.min ? "text-destructive font-bold" : ""}`}>{item.abertura ?? "—"}</TableCell>
                  <TableCell className={`text-right font-mono ${item.fechamento != null && item.fechamento < item.min ? "text-destructive font-bold" : ""}`}>{item.fechamento ?? "—"}</TableCell>
                  <TableCell className={`text-right font-mono ${item.variacao != null && item.variacao < 0 ? "text-destructive" : item.variacao != null && item.variacao > 0 ? "text-green-600" : ""}`}>
                    {item.variacao != null ? (item.variacao > 0 ? `+${item.variacao}` : item.variacao) : "—"}
                  </TableCell>
                  <TableCell>{item.belowMin ? <Badge variant="destructive" className="text-xs">Abaixo</Badge> : <Badge className="bg-green-600 text-xs">OK</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
