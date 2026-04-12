import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUtensiliosItems, useDistinctSemanas, useUtensiliosContagens, useUtensiliosConfig, useCreatePedido } from "@/hooks/useUtensilios";
import { SectorFilter } from "./SectorFilter";
import { DollarSign, ShoppingCart, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

export function ControleBudget() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: items, isLoading } = useUtensiliosItems(effectiveUnidadeId);
  const { data: semanas } = useDistinctSemanas(effectiveUnidadeId);
  const { data: config } = useUtensiliosConfig(effectiveUnidadeId);
  const createPedido = useCreatePedido();
  const isMobile = useIsMobile();

  const [semanaRef, setSemanaRef] = useState("");
  const [setor, setSetor] = useState("Todos");
  const { data: contagens } = useUtensiliosContagens(effectiveUnidadeId, semanaRef || null);

  const budgetMensal = config?.budget_mensal || 0;

  const allocations = useMemo(() => {
    if (!items || !contagens) return [];
    const countMap: Record<string, number> = {};
    contagens.forEach((c: any) => { if (c.turno === "FECHAMENTO") countMap[c.utensilio_item_id] = c.quantidade_contada; });

    let remainingBudget = budgetMensal;
    return items
      .filter((item: any) => setor === "Todos" || item.area_responsavel === setor)
      .map((item: any) => {
        const lastCount = countMap[item.id] ?? 0;
        const min = item.estoque_minimo || 0;
        const deficit = Math.max(0, min - lastCount);
        const unitCost = item.valor_unitario || item.items_catalog?.preco_custo || 0;
        const totalNeeded = deficit * unitCost;
        let qtdAprovada = 0, status = "ok";
        if (deficit > 0) {
          if (remainingBudget >= totalNeeded) { qtdAprovada = deficit; remainingBudget -= totalNeeded; status = "pedir_total"; }
          else if (remainingBudget > 0 && unitCost > 0) { qtdAprovada = Math.floor(remainingBudget / unitCost); remainingBudget -= qtdAprovada * unitCost; status = qtdAprovada > 0 ? "parcial" : "sem_budget"; }
          else status = "sem_budget";
        }
        return { ...item, lastCount, deficit, unitCost, totalNeeded, qtdAprovada, custoAprovado: qtdAprovada * unitCost, status };
      });
  }, [items, contagens, budgetMensal, setor]);

  const summary = useMemo(() => {
    const totalNeeded = allocations.reduce((s, a) => s + a.totalNeeded, 0);
    const totalApproved = allocations.reduce((s, a) => s + a.custoAprovado, 0);
    return { totalNeeded, totalApproved, remaining: budgetMensal - totalApproved };
  }, [allocations, budgetMensal]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "ok": return <Badge className="bg-green-600 text-xs">OK</Badge>;
      case "pedir_total": return <Badge className="bg-blue-600 text-xs">Pedir</Badge>;
      case "parcial": return <Badge className="bg-yellow-500 text-xs">Parcial</Badge>;
      case "sem_budget": return <Badge variant="destructive" className="text-xs">Sem $</Badge>;
      default: return null;
    }
  };

  const handleGerarPedido = () => {
    if (!effectiveUnidadeId || !config) return;
    const pedidos = allocations.filter((a) => a.qtdAprovada > 0).map((a) => ({
      loja_id: effectiveUnidadeId, utensilio_item_id: a.id, config_id: config.id,
      qtd_deficit: a.deficit, qtd_aprovada: a.qtdAprovada, valor_unitario: a.unitCost,
      status: a.status === "pedir_total" ? "APROVADO" : "PARCIAL",
    }));
    if (pedidos.length) createPedido.mutate(pedidos);
  };

  if (!effectiveUnidadeId) return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className={isMobile ? "space-y-3" : "flex flex-wrap gap-3 items-end"}>
        <div className={isMobile ? "w-full" : "flex-1 min-w-[200px]"}>
          <Label>Semana de Referência</Label>
          <Select value={semanaRef} onValueChange={setSemanaRef}>
            <SelectTrigger><SelectValue placeholder="Selecionar semana" /></SelectTrigger>
            <SelectContent>{semanas?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <SectorFilter value={setor} onChange={setSetor} className={isMobile ? "w-full" : "min-w-[160px]"} />
        <Button onClick={handleGerarPedido} disabled={!semanaRef || !config || createPedido.isPending} className={isMobile ? "w-full" : ""}>
          <ShoppingCart className="h-4 w-4 mr-1" />Gerar Pedido
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <DollarSign className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground">Budget</p>
          <p className="text-sm font-bold">R$ {budgetMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <TrendingDown className="h-4 w-4 mx-auto mb-1 text-destructive" />
          <p className="text-[10px] text-muted-foreground">Necessário</p>
          <p className="text-sm font-bold">R$ {summary.totalNeeded.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <ShoppingCart className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground">Aprovado</p>
          <p className="text-sm font-bold">R$ {summary.totalApproved.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <DollarSign className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground">Restante</p>
          <p className="text-sm font-bold">R$ {summary.remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {allocations.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Selecione uma semana.</CardContent></Card>
          ) : allocations.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{a.items_catalog?.name || "—"}</p>
                    <Badge variant="outline" className="text-[10px]">{a.area_responsavel || "Front"}</Badge>
                  </div>
                  {statusBadge(a.status)}
                </div>
                <div className="grid grid-cols-4 gap-1 text-center bg-muted/30 rounded-md p-2">
                  <div><p className="text-[10px] text-muted-foreground">Mín</p><p className="font-mono text-xs">{a.estoque_minimo}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Contg</p><p className="font-mono text-xs">{a.lastCount}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Déficit</p><p className="font-mono text-xs">{a.deficit}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Aprov.</p><p className="font-mono text-xs font-bold">{a.qtdAprovada}</p></div>
                </div>
                <p className="text-xs text-muted-foreground text-right">R$ {a.unitCost.toFixed(2)}/un</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead>Setor</TableHead><TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Contagem</TableHead><TableHead className="text-right">Déficit</TableHead>
              <TableHead className="text-right">Custo Unit.</TableHead><TableHead className="text-right">Qtd Aprov.</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {allocations.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Selecione uma semana com contagens.</TableCell></TableRow>
              ) : allocations.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.items_catalog?.name || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{a.area_responsavel || "Front"}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{a.estoque_minimo}</TableCell>
                  <TableCell className="text-right font-mono">{a.lastCount}</TableCell>
                  <TableCell className="text-right font-mono">{a.deficit}</TableCell>
                  <TableCell className="text-right font-mono">R$ {a.unitCost.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{a.qtdAprovada}</TableCell>
                  <TableCell>{statusBadge(a.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
