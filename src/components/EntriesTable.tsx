import { useState } from "react";
import { ArrowUpDown, Trash2 } from "lucide-react";
import { EditFreelancerDialog } from "@/components/EditFreelancerDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

import { FreelancerEntry } from "@/types/freelancer";
import { formatCurrency, formatDate, parseDateString } from "@/lib/formatters";
import { useFreelancerEntries } from "@/hooks/useFreelancerEntries";

interface EntriesTableProps {
  entries: FreelancerEntry[];
}

type SortField = "data_pop" | "valor" | "nome_completo";
type SortOrder = "asc" | "desc";

export function EntriesTable({ entries }: EntriesTableProps) {
  const { deleteEntry } = useFreelancerEntries();
  const [sortField, setSortField] = useState<SortField>("data_pop");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedEntries = [...entries].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case "data_pop":
        comparison = parseDateString(a.data_pop).getTime() - parseDateString(b.data_pop).getTime();
        break;
      case "valor":
        comparison = a.valor - b.valor;
        break;
      case "nome_completo":
        comparison = a.nome_completo.localeCompare(b.nome_completo);
        break;
    }
    
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 text-xs font-medium hover:bg-transparent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  if (entries.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-muted-foreground">Nenhum lançamento encontrado</div>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Adicione um novo lançamento ou ajuste os filtros
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card fade-in">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">
          Lançamentos ({entries.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px]">
                  <SortButton field="data_pop">Data</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="nome_completo">Nome</SortButton>
                </TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Gerência</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead className="text-right">
                  <SortButton field="valor">Valor</SortButton>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.map((entry) => (
                <TableRow key={entry.id} className="table-row-animated">
                  <TableCell className="font-medium">
                    {formatDate(entry.data_pop)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {entry.nome_completo}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {entry.loja}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.funcao}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={entry.gerencia === "FRONT" ? "default" : "outline"}
                      className="font-normal"
                    >
                      {entry.gerencia}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {entry.cpf}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">
                    {entry.chave_pix}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {formatCurrency(entry.valor)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <EditFreelancerDialog entry={entry} />
                      <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O lançamento de{" "}
                            <strong>{entry.nome_completo}</strong> será removido
                            permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteEntry.mutate(entry.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
