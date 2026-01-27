import { User, Trash2, Calendar, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FreelancerEntry } from "@/types/freelancer";
import { formatCurrency } from "@/lib/formatters";

interface MobileFreelancerCardProps {
  entry: FreelancerEntry;
  onDelete: (id: string) => void;
}

export function MobileFreelancerCard({ entry, onDelete }: MobileFreelancerCardProps) {
  const [year, month, day] = entry.data_pop.split("-");
  
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
      {/* Header with name and value */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{entry.nome_completo}</p>
            <p className="text-sm text-muted-foreground truncate">
              {entry.funcao}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-primary">
            {formatCurrency(entry.valor)}
          </p>
        </div>
      </div>
      
      {/* Details */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Building2 className="h-3 w-3" />
          {entry.loja}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Calendar className="h-3 w-3" />
          {`${day}/${month}`}
        </Badge>
        <Badge
          variant={entry.gerencia === "FRONT" ? "default" : "outline"}
        >
          {entry.gerencia}
        </Badge>
      </div>
      
      {/* Actions */}
      <div className="mt-4 flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
              <AlertDialogDescription>
                O lançamento de <strong>{entry.nome_completo}</strong> será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(entry.id)}
                className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
