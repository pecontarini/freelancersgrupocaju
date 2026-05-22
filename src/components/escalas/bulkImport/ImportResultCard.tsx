import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, ExternalLink, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ImportResult = {
  log_id: string;
  draft_id: string;
  total_linhas: number;
  total_sucesso: number;
  total_erro: number;
  erros?: Array<{ linha?: number; employee_id?: string; data?: string; motivo: string }>;
  status: "sucesso" | "parcial" | "erro";
};

interface Props {
  result: ImportResult;
  fileName: string;
  importedAt: Date;
  employeeNameMap: Record<string, string>;
  onOpenHistory: () => void;
}

export function ImportResultCard({
  result,
  fileName,
  importedAt,
  employeeNameMap,
  onOpenHistory,
}: Props) {
  const hasErrors = result.total_erro > 0 && Array.isArray(result.erros);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resultado da Importação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-xs text-muted-foreground">Sucessos</div>
              <div className="text-xl font-semibold text-emerald-700">
                {result.total_sucesso}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <div>
              <div className="text-xs text-muted-foreground">Erros</div>
              <div className="text-xl font-semibold text-orange-700">{result.total_erro}</div>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <div>
            <span className="font-medium">Arquivo:</span> {fileName}
          </div>
          <div>
            <span className="font-medium">Importado em:</span>{" "}
            {format(importedAt, "dd/MM/yyyy HH:mm")}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {result.draft_id && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/escalas/draft/${result.draft_id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver draft criado
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onOpenHistory}>
            <History className="mr-2 h-4 w-4" />
            Ver histórico de importações desta unidade
          </Button>
        </div>

        {hasErrors && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.erros!.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{e.linha ?? "—"}</TableCell>
                    <TableCell>
                      {(e.employee_id && employeeNameMap[e.employee_id]) ||
                        e.employee_id ||
                        "—"}
                    </TableCell>
                    <TableCell>{e.data ?? "—"}</TableCell>
                    <TableCell className="text-xs">{e.motivo}</TableCell>
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
