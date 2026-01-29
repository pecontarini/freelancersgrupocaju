import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  CheckCircle2,
  Building2,
  ExternalLink,
  Search,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { type ActionPlan } from "@/hooks/useActionPlans";
import type { Reclamacao } from "@/hooks/useReclamacoes";
import type { ConfigOption } from "@/hooks/useConfigOptions";
import { useIsMobile } from "@/hooks/use-mobile";

interface CXHistoryArchiveProps {
  reclamacoes: Reclamacao[];
  actionPlans: ActionPlan[];
  lojas: ConfigOption[];
  selectedLojaId: string | null;
}

const FONTE_LABELS: Record<string, string> = {
  google: "Google",
  ifood: "iFood",
  tripadvisor: "TripAdvisor",
  getin: "Get In",
  manual: "Manual",
  sheets: "Planilha",
};

export function CXHistoryArchive({
  reclamacoes,
  actionPlans,
  lojas,
  selectedLojaId,
}: CXHistoryArchiveProps) {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");

  const lojaMap = useMemo(() => {
    return new Map(lojas.map((l) => [l.id, l.nome]));
  }, [lojas]);

  // Filter reclamacoes by search term
  const filteredReclamacoes = useMemo(() => {
    if (!searchTerm) return reclamacoes;

    const term = searchTerm.toLowerCase();
    return reclamacoes.filter(
      (r) =>
        r.texto_original?.toLowerCase().includes(term) ||
        r.resumo_ia?.toLowerCase().includes(term) ||
        lojaMap.get(r.loja_id)?.toLowerCase().includes(term) ||
        FONTE_LABELS[r.fonte]?.toLowerCase().includes(term)
    );
  }, [reclamacoes, searchTerm, lojaMap]);

  // Group by resolved action plans
  const resolvedPlans = actionPlans.filter((ap) => ap.status === "resolved");

  if (reclamacoes.length === 0 && resolvedPlans.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum histórico disponível para o período selecionado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por texto, unidade ou fonte..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Resolved Action Plans Section */}
      {resolvedPlans.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base uppercase flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Planos de Ação Resolvidos ({resolvedPlans.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              <div className="space-y-3">
                {resolvedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-primary">{plan.pain_tag}</p>
                      <Badge className="bg-emerald-500">Resolvido</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {lojaMap.get(plan.loja_id) || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Validado em:{" "}
                      {plan.validated_at
                        ? format(new Date(plan.validated_at), "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </p>
                    {plan.causa_raiz && (
                      <p className="text-sm mt-2 line-clamp-2">{plan.causa_raiz}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Dor</TableHead>
                      {!selectedLojaId && <TableHead className="text-xs">Unidade</TableHead>}
                      <TableHead className="text-xs">Causa Raiz</TableHead>
                      <TableHead className="text-xs">Validado em</TableHead>
                      <TableHead className="text-xs w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedPlans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium text-primary">
                          {plan.pain_tag}
                        </TableCell>
                        {!selectedLojaId && (
                          <TableCell className="text-sm">
                            {lojaMap.get(plan.loja_id) || "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-sm max-w-[200px]">
                          <p className="line-clamp-2">{plan.causa_raiz || "—"}</p>
                        </TableCell>
                        <TableCell className="text-xs">
                          {plan.validated_at
                            ? format(new Date(plan.validated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {plan.evidencia_url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={plan.evidencia_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Complaints History */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base uppercase flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Histórico de Reclamações ({filteredReclamacoes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {filteredReclamacoes.map((rec) => (
                <div key={rec.id} className="p-3 rounded-lg border">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Badge variant="secondary" className="text-xs">
                        {FONTE_LABELS[rec.fonte] || rec.fonte}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(rec.data_reclamacao), "dd/MM/yyyy")}
                      </p>
                    </div>
                    {rec.is_grave && <Badge variant="destructive">Grave</Badge>}
                  </div>
                  {!selectedLojaId && (
                    <p className="text-sm font-medium mb-1">{lojaMap.get(rec.loja_id) || "—"}</p>
                  )}
                  {rec.resumo_ia && <p className="text-sm line-clamp-3">{rec.resumo_ia}</p>}
                </div>
              ))}
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
                    <TableHead className="text-xs">Resumo</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReclamacoes.map((rec) => (
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
                        <Badge variant="secondary" className="text-xs">
                          {FONTE_LABELS[rec.fonte] || rec.fonte}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{rec.tipo_operacao}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-bold ${rec.is_grave ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {rec.nota_reclamacao}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        <p className="line-clamp-2">{rec.resumo_ia || rec.texto_original || "—"}</p>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
