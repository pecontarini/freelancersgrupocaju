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
import { ShieldAlert } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function UrgentCltConfirmDialog({ open, onOpenChange, onConfirm, loading }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle>Solicitar cadastro urgente</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2 text-sm text-muted-foreground">
              <p>
                Esta opção é apenas para casos onde o funcionário precisa trabalhar
                imediatamente e não há tempo de aguardar o cadastro normal no Secullum.
              </p>
              <p className="font-medium text-foreground">Ao confirmar:</p>
              <ul className="space-y-1 pl-4 list-disc">
                <li>Cadastro criado com flag "aguardando_secullum".</li>
                <li>DP receberá notificação para regularizar no Secullum em até 7 dias.</li>
                <li>Funcionário pode ser escalado neste período.</li>
                <li>Se não regularizado em 7 dias, inativação automática.</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading}>
            Confirmar solicitação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
