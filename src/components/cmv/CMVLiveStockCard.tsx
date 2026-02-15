import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Package, TrendingUp, TrendingDown, AlertTriangle, Clock, RefreshCw, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useRealtimeStock, RealtimeStockPosition } from "@/hooks/useRealtimeStock";
import { formatCurrency } from "@/lib/formatters";

export function CMVLiveStockCard() {
  const { effectiveUnidadeId } = useUnidade();
  const {
    positions,
    totalValue,
    totalItems,
    totalEntries,
    lastGeneralCountDate,
    negativeItems,
    uncountedItems,
    isLoading,
    refetch,
  } = useRealtimeStock(effectiveUnidadeId || undefined);

  const formattedLastCount = useMemo(() => {
    if (!lastGeneralCountDate) return "Nunca";
    const [y, m, d] = lastGeneralCountDate.split("-");
    return `${d}/${m}/${y}`;
  }, [lastGeneralCountDate]);

  // Group by category
  const byCategory = useMemo(() => {
    const map = new Map<string, RealtimeStockPosition[]>();
    for (const p of positions) {
      const cat = p.categoria || "Sem categoria";
      const arr = map.get(cat) || [];
      arr.push(p);
      map.set(cat, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [positions]);

  if (!effectiveUnidadeId) return null;

  return (
    <div className="space-y-4">
      {/* Main Valuation Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Estoque em Tempo Real
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              className="h-8 w-8"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Value */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Valor Total</p>
              <p className="text-2xl font-bold text-primary">
                {isLoading ? "..." : formatCurrency(totalValue)}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Contagem: {formattedLastCount}
              </p>
            </div>

            {/* Items Tracked */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Itens Rastreados</p>
              <p className="text-2xl font-bold">{totalItems}</p>
              <p className="text-xs text-muted-foreground">
                +{totalEntries.toLocaleString("pt-BR")} entradas recentes
              </p>
            </div>

            {/* Alerts */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Estoque Negativo</p>
              <p className={`text-2xl font-bold ${negativeItems.length > 0 ? "text-destructive" : "text-green-600"}`}>
                {negativeItems.length}
              </p>
              {negativeItems.length > 0 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Requer atenção
                </p>
              )}
            </div>

            {/* Uncounted */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Sem Contagem</p>
              <p className={`text-2xl font-bold ${uncountedItems.length > 0 ? "text-amber-500" : ""}`}>
                {uncountedItems.length}
              </p>
              <p className="text-xs text-muted-foreground">
                itens sem auditoria
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Breakdown by Category */}
      {positions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Posição Detalhada por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion type="multiple" className="w-full">
              {byCategory.map(([cat, items]) => {
                const catValue = items.reduce((s, i) => s + (i.current_value || 0), 0);
                return (
                  <AccordionItem key={cat} value={cat}>
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-3 w-full mr-4">
                        <span className="font-medium text-sm">{cat}</span>
                        <Badge variant="secondary" className="text-xs">{items.length} itens</Badge>
                        <span className="ml-auto text-sm font-medium">
                          {formatCurrency(catValue)}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pb-2">
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-right w-20">Contado</TableHead>
                              <TableHead className="text-right w-20">
                                <TrendingUp className="h-3 w-3 inline mr-1 text-green-600" />
                                Entr.
                              </TableHead>
                              <TableHead className="text-right w-20">
                                <TrendingDown className="h-3 w-3 inline mr-1 text-destructive" />
                                Saídas
                              </TableHead>
                              <TableHead className="text-right w-24 font-bold">Saldo</TableHead>
                              <TableHead className="text-right w-28">Valor (R$)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items
                              .sort((a, b) => (b.current_value || 0) - (a.current_value || 0))
                              .map((item) => (
                                <TableRow
                                  key={item.item_id}
                                  className={item.current_qty < 0 ? "bg-destructive/5" : ""}
                                >
                                  <TableCell className="text-sm">
                                    <div>
                                      {item.item_name}
                                      {item.days_since_count != null && item.days_since_count > 7 && (
                                        <Badge variant="outline" className="ml-2 text-[10px] text-amber-600 border-amber-300">
                                          {item.days_since_count}d
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs">
                                    {item.last_count_qty.toLocaleString("pt-BR")} {item.unidade}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs text-green-600">
                                    +{item.entries_qty.toLocaleString("pt-BR")}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs text-destructive">
                                    -{item.exits_qty.toLocaleString("pt-BR")}
                                  </TableCell>
                                  <TableCell className={`text-right font-mono text-sm font-bold ${item.current_qty < 0 ? "text-destructive" : ""}`}>
                                    {item.current_qty.toLocaleString("pt-BR")} {item.unidade}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {formatCurrency(item.current_value || 0)}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
