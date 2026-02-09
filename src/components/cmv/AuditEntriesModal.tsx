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
import { Loader2, PackagePlus } from "lucide-react";
import { format } from "date-fns";

interface AuditEntriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  lojaId: string;
  startDate: string;
  endDate: string;
}

export function AuditEntriesModal({
  open,
  onOpenChange,
  itemId,
  itemName,
  lojaId,
  startDate,
  endDate,
}: AuditEntriesModalProps) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["audit-entries-detail", itemId, lojaId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_movements")
        .select("*")
        .eq("cmv_item_id", itemId)
        .eq("loja_id", lojaId)
        .eq("tipo_movimento", "entrada")
        .gte("data_movimento", startDate)
        .lte("data_movimento", endDate)
        .order("data_movimento", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!itemId,
  });

  const total = entries?.reduce((s, e) => s + e.quantidade, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-green-600" />
            Entradas (NFe) — {itemName}
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
        ) : entries && entries.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Referência / Fornecedor</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {format(new Date(entry.data_movimento + "T12:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{entry.referencia || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      +{entry.quantidade}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.preco_unitario
                        ? `R$ ${Number(entry.preco_unitario).toFixed(2)}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right font-mono text-green-600">
                    +{total}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <PackagePlus className="h-10 w-10 mb-2 opacity-40" />
            <p>Nenhuma entrada registrada neste período</p>
          </div>
        )}

        {entries && entries.length > 0 && (
          <Badge variant="outline" className="w-fit">
            {entries.length} nota(s) encontrada(s)
          </Badge>
        )}
      </DialogContent>
    </Dialog>
  );
}
