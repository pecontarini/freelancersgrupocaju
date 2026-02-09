import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingCart } from "lucide-react";
import { format } from "date-fns";

interface AuditSalesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  lojaId: string;
  startDate: string;
  endDate: string;
}

interface SalesDetail {
  sale_date: string;
  item_name: string;
  quantity: number;
  multiplicador: number;
  total_consumed: number;
}

export function AuditSalesModal({
  open,
  onOpenChange,
  itemId,
  itemName,
  lojaId,
  startDate,
  endDate,
}: AuditSalesModalProps) {
  const { data: salesDetails, isLoading } = useQuery({
    queryKey: ["audit-sales-detail", itemId, lojaId, startDate, endDate],
    queryFn: async () => {
      // Get all mappings for this item
      const { data: mappings, error: mapError } = await supabase
        .from("cmv_sales_mappings")
        .select("nome_venda, multiplicador")
        .eq("cmv_item_id", itemId);

      if (mapError) throw mapError;
      if (!mappings || mappings.length === 0) return [];

      // For each mapping, get the daily_sales
      const results: SalesDetail[] = [];

      for (const mapping of mappings) {
        const { data: sales, error: salesError } = await supabase
          .from("daily_sales")
          .select("sale_date, item_name, quantity")
          .eq("unit_id", lojaId)
          .gte("sale_date", startDate)
          .lte("sale_date", endDate)
          .ilike("item_name", mapping.nome_venda);

        if (salesError) throw salesError;

        if (sales) {
          for (const sale of sales) {
            results.push({
              sale_date: sale.sale_date,
              item_name: sale.item_name,
              quantity: sale.quantity,
              multiplicador: mapping.multiplicador,
              total_consumed: sale.quantity * mapping.multiplicador,
            });
          }
        }
      }

      results.sort((a, b) => a.sale_date.localeCompare(b.sale_date));
      return results;
    },
    enabled: open && !!itemId,
  });

  const totalConsumed =
    salesDetails?.reduce((s, d) => s + d.total_consumed, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-orange-600" />
            Vendas Teóricas — {itemName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Período: {format(new Date(startDate + "T12:00:00"), "dd/MM/yyyy")} a{" "}
          {format(new Date(endDate + "T12:00:00"), "dd/MM/yyyy")}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : salesDetails && salesDetails.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Prato Vendido</TableHead>
                  <TableHead className="text-right">Qtd Venda</TableHead>
                  <TableHead className="text-right">Fator (×)</TableHead>
                  <TableHead className="text-right">Total Abatido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesDetails.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {format(new Date(row.sale_date + "T12:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{row.item_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {row.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge variant="outline" className="font-mono">
                        ×{row.multiplicador}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-orange-600">
                      -{row.total_consumed.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={4}>Total Consumido</TableCell>
                  <TableCell className="text-right font-mono text-orange-600">
                    -{totalConsumed.toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mb-2 opacity-40" />
            <p>Nenhuma venda mapeada para este item no período</p>
          </div>
        )}

        {salesDetails && salesDetails.length > 0 && (
          <Badge variant="outline" className="w-fit">
            {salesDetails.length} registro(s) de venda
          </Badge>
        )}
      </DialogContent>
    </Dialog>
  );
}
