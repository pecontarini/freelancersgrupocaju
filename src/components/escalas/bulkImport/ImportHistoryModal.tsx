import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string | null;
}

type LogRow = {
  id: string;
  week_start_date: string;
  imported_at: string;
  imported_by: string | null;
  total_linhas: number;
  total_sucesso: number;
  total_erro: number;
  status: string;
  arquivo_nome: string | null;
  draft_id: string | null;
  erros: any;
};

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    sucesso: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    parcial: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    erro: "bg-red-500/15 text-red-700 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={variants[status] ?? ""}>
      {status}
    </Badge>
  );
}

export function ImportHistoryModal({ open, onOpenChange, unitId }: Props) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !unitId) return;
    setLoading(true);
    setExpanded(new Set());
    (async () => {
      const { data, error } = await supabase
        .from("bulk_import_logs")
        .select(
          "id, week_start_date, imported_at, imported_by, total_linhas, total_sucesso, total_erro, status, arquivo_nome, draft_id, erros",
        )
        .eq("unit_id", unitId)
        .order("imported_at", { ascending: false })
        .limit(20);

      if (error) {
        toast.error("Erro ao carregar histórico");
        setRows([]);
      } else {
        setRows((data as LogRow[]) ?? []);
      }
      setLoading(false);
    })();
  }, [open, unitId]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Histórico de Importações</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma importação registrada para esta unidade.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Semana</TableHead>
                  <TableHead>Importado em</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Sucesso</TableHead>
                  <TableHead className="text-right">Erro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isOpen = expanded.has(r.id);
                  const errosArr = Array.isArray(r.erros) ? r.erros : [];
                  return (
                    <Fragment key={r.id}>
                      <TableRow>
                        <TableCell>
                          {errosArr.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggle(r.id)}
                              aria-label={isOpen ? "Recolher erros" : "Ver erros"}
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(r.week_start_date + "T00:00:00"), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(r.imported_at), "dd/MM HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">{r.total_linhas}</TableCell>
                        <TableCell className="text-right text-emerald-700">
                          {r.total_sucesso}
                        </TableCell>
                        <TableCell className="text-right text-orange-700">
                          {r.total_erro}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">
                          {r.arquivo_nome ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.draft_id && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/escalas/draft/${r.draft_id}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isOpen && errosArr.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/30">
                            <div className="space-y-1 py-2">
                              {errosArr.map((e: any, i: number) => (
                                <div key={i} className="text-xs">
                                  <span className="font-medium">
                                    Linha {e.linha ?? "—"}:
                                  </span>{" "}
                                  {e.motivo}
                                  {e.data ? ` (${e.data})` : ""}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
