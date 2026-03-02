import { Trash2, ExternalLink, FileText } from "lucide-react";
import { EditMaintenanceDialog } from "@/components/EditMaintenanceDialog";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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

import { MaintenanceEntry } from "@/types/maintenance";
import { formatCurrency } from "@/lib/formatters";
import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";
import { MaintenanceSingleExportButton } from "@/components/MaintenanceSingleExportButton";

interface MaintenanceListProps {
  entries: MaintenanceEntry[];
}

export function MaintenanceList({ entries }: MaintenanceListProps) {
  const { deleteEntry } = useMaintenanceEntries();

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhuma manutenção cadastrada</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre uma nova manutenção usando o formulário acima.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>NF</TableHead>
            <TableHead>Loja</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">NF</TableHead>
            <TableHead className="text-center">Boleto</TableHead>
            <TableHead className="text-center">PDF</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">
                {formatDate(entry.data_servico)}
              </TableCell>
              <TableCell>{entry.fornecedor}</TableCell>
              <TableCell>{entry.numero_nf}</TableCell>
              <TableCell>{entry.loja}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {entry.descricao || "-"}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(entry.valor)}
              </TableCell>
              <TableCell className="text-center">
                {entry.anexo_url ? (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={entry.anexo_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {entry.boleto_url ? (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={entry.boleto_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <MaintenanceSingleExportButton entry={entry} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <EditMaintenanceDialog entry={entry} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Deseja realmente excluir este registro de manutenção? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteEntry(entry.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
  );
}
