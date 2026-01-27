import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, TrendingUp, CalendarDays, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { usePerformanceEntries, type PerformanceEntry } from "@/hooks/usePerformanceEntries";

interface PerformanceEntriesListProps {
  selectedLojaId?: string | null;
}

export function PerformanceEntriesList({ selectedLojaId }: PerformanceEntriesListProps) {
  const { options: lojas } = useConfigLojas();
  const { entries, isLoading, deleteEntry, aggregatedByStore, currentMonthYear } = usePerformanceEntries();
  const [entryToDelete, setEntryToDelete] = useState<PerformanceEntry | null>(null);

  // Filter entries by selected store if provided
  const filteredEntries = selectedLojaId
    ? entries.filter((e) => e.loja_id === selectedLojaId)
    : entries;

  const getLojaName = (lojaId: string) => {
    return lojas.find((l) => l.id === lojaId)?.nome || "Unidade Desconhecida";
  };

  const handleDelete = async () => {
    if (!entryToDelete) return;
    await deleteEntry.mutateAsync(entryToDelete.id);
    setEntryToDelete(null);
  };

  // Get aggregated totals for display
  const aggregatedTotals = selectedLojaId
    ? aggregatedByStore[selectedLojaId]
    : null;

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <CalendarDays className="h-5 w-5 text-primary" />
            Lançamentos do Mês ({format(new Date(currentMonthYear + "-01"), "MMMM/yyyy", { locale: ptBR })})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Aggregated Summary */}
          {aggregatedTotals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 rounded-xl bg-muted/50">
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase">Fat. Salão Acumulado</p>
                <p className="text-lg font-bold text-amber-600">
                  {formatCurrency(aggregatedTotals.total_faturamento_salao)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase">Fat. Delivery Acumulado</p>
                <p className="text-lg font-bold text-sky-600">
                  {formatCurrency(aggregatedTotals.total_faturamento_delivery)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase">Reclamações Totais</p>
                <p className="text-lg font-bold text-destructive">
                  {aggregatedTotals.total_reclamacoes}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase">Média Diária</p>
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(aggregatedTotals.daily_average_faturamento)}
                </p>
              </div>
            </div>
          )}

          {/* Entries Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                {!selectedLojaId && <TableHead>Unidade</TableHead>}
                <TableHead className="text-right">Salão</TableHead>
                <TableHead className="text-right">Delivery</TableHead>
                <TableHead className="text-center">Rec. Salão</TableHead>
                <TableHead className="text-center">Rec. iFood</TableHead>
                <TableHead className="w-16">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={selectedLojaId ? 6 : 7} className="text-center py-8 text-muted-foreground">
                    Nenhum lançamento encontrado para este mês.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {formatDate(entry.entry_date)}
                      </Badge>
                    </TableCell>
                    {!selectedLojaId && (
                      <TableCell className="font-medium">
                        {getLojaName(entry.loja_id)}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-medium text-amber-600">
                      {formatCurrency(Number(entry.faturamento_salao))}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sky-600">
                      {formatCurrency(Number(entry.faturamento_delivery))}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={entry.reclamacoes_salao > 0 ? "destructive" : "secondary"}>
                        {entry.reclamacoes_salao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={entry.reclamacoes_ifood > 0 ? "destructive" : "secondary"}>
                        {entry.reclamacoes_ifood}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setEntryToDelete(entry)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja excluir este lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e removerá o registro do cálculo de ranking e projeções da unidade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
