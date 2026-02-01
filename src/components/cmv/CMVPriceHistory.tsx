import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PriceHistoryEntry {
  id: string;
  cmv_item_id: string;
  preco_anterior: number;
  preco_novo: number;
  fonte: string;
  referencia_nf: string | null;
  created_at: string;
  cmv_item?: {
    nome: string;
  };
}

export function CMVPriceHistory() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["cmv-price-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_price_history")
        .select("*, cmv_item:cmv_items(nome)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as PriceHistoryEntry[];
    },
  });

  const getVariation = (oldPrice: number, newPrice: number) => {
    const variation = ((newPrice - oldPrice) / oldPrice) * 100;
    return variation;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando histórico...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Preços
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            Nenhuma alteração de preço registrada
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Preço Anterior</TableHead>
                  <TableHead>Preço Novo</TableHead>
                  <TableHead>Variação</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => {
                  const variation = getVariation(entry.preco_anterior, entry.preco_novo);
                  const isIncrease = variation > 0;
                  
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.cmv_item?.nome || "Item removido"}
                      </TableCell>
                      <TableCell>R$ {entry.preco_anterior.toFixed(2)}</TableCell>
                      <TableCell>R$ {entry.preco_novo.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={isIncrease ? "text-red-600 border-red-300" : "text-green-600 border-green-300"}
                        >
                          {isIncrease ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {isIncrease ? "+" : ""}{variation.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {entry.fonte === "nfe" ? "NFe" : "Manual"}
                        </Badge>
                        {entry.referencia_nf && (
                          <span className="text-xs text-muted-foreground ml-1">
                            #{entry.referencia_nf}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
