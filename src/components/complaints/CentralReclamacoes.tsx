import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useReclamacoes, type FonteReclamacao } from "@/hooks/useReclamacoes";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { ReclamacaoModal } from "./ReclamacaoModal";

interface CentralReclamacoesProps {
  selectedLojaId?: string | null;
}

const FONTE_LABELS: Record<FonteReclamacao, string> = {
  google: "Google",
  ifood: "iFood",
  tripadvisor: "TripAdvisor",
  getin: "Get In",
  manual: "Manual",
  sheets: "Planilha",
};

const FONTE_COLORS: Record<FonteReclamacao, string> = {
  google: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  ifood: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  tripadvisor: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  getin: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  manual: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  sheets: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

export function CentralReclamacoes({ selectedLojaId }: CentralReclamacoesProps) {
  const currentMonth = format(new Date(), "yyyy-MM");
  const { reclamacoes, isLoading, deleteReclamacao, agregadoPorLoja } = useReclamacoes(
    selectedLojaId || undefined,
    currentMonth
  );
  const { options: lojas } = useConfigLojas();

  const lojaMap = useMemo(() => {
    return new Map(lojas.map((l) => [l.id, l.nome]));
  }, [lojas]);

  // Summary stats
  const stats = useMemo(() => {
    const total = reclamacoes.length;
    const graves = reclamacoes.filter((r) => r.is_grave).length;
    const salao = reclamacoes.filter((r) => r.tipo_operacao === "salao").length;
    const delivery = reclamacoes.filter((r) => r.tipo_operacao === "delivery").length;
    return { total, graves, salao, delivery };
  }, [reclamacoes]);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Central de Reclamações
            </CardTitle>
            <CardDescription>
              {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
            </CardDescription>
          </div>
          <ReclamacaoModal
            selectedLojaId={selectedLojaId}
            trigger={
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            }
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="rounded-lg bg-destructive/10 p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.graves}</p>
            <p className="text-xs text-muted-foreground">Graves</p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.salao}</p>
            <p className="text-xs text-muted-foreground">Salão</p>
          </div>
          <div className="rounded-lg bg-sky-50 dark:bg-sky-950/30 p-3 text-center">
            <p className="text-2xl font-bold text-sky-600">{stats.delivery}</p>
            <p className="text-xs text-muted-foreground">Delivery</p>
          </div>
        </div>

        {/* Reclamações Table */}
        {reclamacoes.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma reclamação registrada este mês.</p>
          </div>
        ) : (
          <div className="rounded-lg border max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  {!selectedLojaId && <TableHead className="text-xs">Unidade</TableHead>}
                  <TableHead className="text-xs">Fonte</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs text-center">Nota</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reclamacoes.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="text-xs">
                      {format(new Date(rec.data_reclamacao), "dd/MM")}
                    </TableCell>
                    {!selectedLojaId && (
                      <TableCell className="text-xs font-medium">
                        {lojaMap.get(rec.loja_id) || "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${FONTE_COLORS[rec.fonte]}`}>
                        {FONTE_LABELS[rec.fonte]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{rec.tipo_operacao}</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${rec.is_grave ? "text-destructive" : "text-muted-foreground"}`}>
                        {rec.nota_reclamacao}
                      </span>
                    </TableCell>
                    <TableCell>
                      {rec.is_grave ? (
                        <Badge variant="destructive" className="text-xs">
                          Grave
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Normal
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {rec.anexo_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            asChild
                          >
                            <a href={rec.anexo_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover reclamação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A reclamação será removida permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteReclamacao.mutate(rec.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Remover
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
        )}
      </CardContent>
    </Card>
  );
}
