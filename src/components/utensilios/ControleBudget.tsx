import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUtensiliosBudgetConfig, useUtensiliosSemanas, useUtensiliosContagens, useCreatePedido } from "@/hooks/useUtensilios";
import { DollarSign, ShoppingCart, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function ControleBudget() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: items, isLoading } = useUtensiliosBudgetConfig(effectiveUnidadeId);
  const { data: semanas } = useUtensiliosSemanas(effectiveUnidadeId);
  const createPedido = useCreatePedido();

  const [budgetMensal, setBudgetMensal] = useState<number>(0);
  const [selectedSemana, setSelectedSemana] = useState<string>("");

  const { data: contagens } = useUtensiliosContagens(selectedSemana || null);

  // Calculate needs based on last closing count vs minimum
  const allocations = useMemo(() => {
    if (!items || !contagens) return [];

    const countMap: Record<string, number> = {};
    contagens.forEach((c: any) => {
      if (c.turno === "FECHAMENTO") {
        countMap[c.utensilio_item_id] = c.quantidade_contada;
      }
    });

    let remainingBudget = budgetMensal;
    const result = items.map((item: any) => {
      const lastCount = countMap[item.id] ?? 0;
      const min = item.estoque_minimo || 0;
      const deficit = Math.max(0, min - lastCount);
      const unitCost = item.items_catalog?.preco_custo || item.valor_unitario || 0;
      const totalNeeded = deficit * unitCost;

      let qtdAprovada = 0;
      let status = "ok";

      if (deficit > 0) {
        if (remainingBudget >= totalNeeded) {
          qtdAprovada = deficit;
          remainingBudget -= totalNeeded;
          status = "pedir_total";
        } else if (remainingBudget > 0 && unitCost > 0) {
          qtdAprovada = Math.floor(remainingBudget / unitCost);
          remainingBudget -= qtdAprovada * unitCost;
          status = qtdAprovada > 0 ? "parcial" : "sem_budget";
        } else {
          status = "sem_budget";
        }
      }

      return {
        ...item,
        lastCount,
        deficit,
        unitCost,
        totalNeeded,
        qtdAprovada,
        custoAprovado: qtdAprovada * unitCost,
        status,
      };
    });
    return result;
  }, [items, contagens, budgetMensal]);

  const summary = useMemo(() => {
    const totalNeeded = allocations.reduce((s, a) => s + a.totalNeeded, 0);
    const totalApproved = allocations.reduce((s, a) => s + a.custoAprovado, 0);
    const itemsWithDeficit = allocations.filter((a) => a.deficit > 0).length;
    return { totalNeeded, totalApproved, itemsWithDeficit, remaining: budgetMensal - totalApproved };
  }, [allocations, budgetMensal]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "ok": return <Badge className="bg-green-600 text-xs">OK</Badge>;
      case "pedir_total": return <Badge className="bg-blue-600 text-xs">Pedir Total</Badge>;
      case "parcial": return <Badge className="bg-yellow-500 text-foreground text-xs">Parcial</Badge>;
      case "sem_budget": return <Badge variant="destructive" className="text-xs">Sem Budget</Badge>;
      default: return null;
    }
  };

  const handleGerarPedido = () => {
    if (!effectiveUnidadeId || !selectedSemana) return;
    const pedidos = allocations
      .filter((a) => a.qtdAprovada > 0)
      .map((a) => ({
        loja_id: effectiveUnidadeId,
        utensilio_item_id: a.id,
        semana_id: selectedSemana,
        qtd_necessaria: a.deficit,
        qtd_aprovada: a.qtdAprovada,
        status: a.status === "pedir_total" ? "APROVADO" : "PARCIAL",
      }));
    if (pedidos.length) createPedido.mutate(pedidos);
  };

  if (!effectiveUnidadeId) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  }

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label>Budget Mensal (R$)</Label>
          <Input type="number" min={0} step={100} value={budgetMensal} onChange={(e) => setBudgetMensal(parseFloat(e.target.value) || 0)} className="w-[180px]" />
        </div>
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
        <Button onClick={handleGerarPedido} disabled={!selectedSemana || createPedido.isPending}>
          <ShoppingCart className="h-4 w-4 mr-1" />Gerar Pedido
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Budget</p>
            <p className="text-lg font-bold">R$ {budgetMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className="text-xs text-muted-foreground">Necessário</p>
            <p className="text-lg font-bold">R$ {summary.totalNeeded.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xs text-muted-foreground">Aprovado</p>
            <p className="text-lg font-bold">R$ {summary.totalApproved.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-xs text-muted-foreground">Restante</p>
            <p className="text-lg font-bold">R$ {summary.remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Allocation table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Contagem</TableHead>
                <TableHead className="text-right">Déficit</TableHead>
                <TableHead className="text-right">Custo Unit.</TableHead>
                <TableHead className="text-right">Custo Total</TableHead>
                <TableHead className="text-right">Qtd Aprovada</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Selecione uma semana com contagens.</TableCell></TableRow>
              ) : (
                allocations.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.items_catalog?.name || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{a.estoque_minimo}</TableCell>
                    <TableCell className="text-right font-mono">{a.lastCount}</TableCell>
                    <TableCell className="text-right font-mono">{a.deficit}</TableCell>
                    <TableCell className="text-right font-mono">R$ {a.unitCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">R$ {a.totalNeeded.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{a.qtdAprovada}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
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
