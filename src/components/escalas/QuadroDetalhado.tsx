import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuadroDetalhado, type QuadroDetalhadoRow } from "@/hooks/useQuadroDetalhado";

interface QuadroDetalhadoProps {
  unitId: string;
  unitName: string;
  data: string;
  onBack: () => void;
}

type RefeicaoFilter = "TODOS" | "ALMOCO" | "JANTAR";

function defaultRefeicao(): RefeicaoFilter {
  return new Date().getHours() < 15 ? "ALMOCO" : "JANTAR";
}

function fmtDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}

function sortRows(rows: QuadroDetalhadoRow[]): QuadroDetalhadoRow[] {
  return [...rows].sort((a, b) => {
    const t = (a.scheduled_inicio_hora || "").localeCompare(b.scheduled_inicio_hora || "");
    if (t !== 0) return t;
    return (a.employee_name || "").localeCompare(b.employee_name || "");
  });
}

export function QuadroDetalhado({ unitId, unitName, data, onBack }: QuadroDetalhadoProps) {
  const { data: rows = [], isLoading } = useQuadroDetalhado(data, unitId);
  const [refeicao, setRefeicao] = useState<RefeicaoFilter>(defaultRefeicao());
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (refeicao !== "TODOS" && r.refeicao !== refeicao) return false;
      if (q && !(r.employee_name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, refeicao, query]);

  const aguardando = useMemo(
    () => sortRows(filtered.filter((r) => r.status === "AGUARDANDO")),
    [filtered],
  );
  const presentes = useMemo(
    () => sortRows(filtered.filter((r) => r.status === "PRESENTE" || r.status === "ATRASO")),
    [filtered],
  );
  const ausentes = useMemo(
    () => sortRows(filtered.filter((r) => r.status === "AUSENTE")),
    [filtered],
  );

  const total = filtered.length;
  const bateram = presentes.length;
  const faltam = ausentes.length;
  const presencaPct = total > 0 ? Math.round((bateram / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar para Visão Geral
        </Button>
        <div>
          <h3 className="text-base font-semibold">Quadro Detalhado — {unitName}</h3>
          <p className="text-xs text-muted-foreground">{fmtDate(data)}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Escalados</p>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Bateram</p>
            <p className="text-2xl font-bold text-green-700">{bateram}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Faltam</p>
            <p className="text-2xl font-bold text-red-700">{faltam}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Presença</p>
            <p className="text-2xl font-bold">{presencaPct}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={refeicao} onValueChange={(v) => setRefeicao(v as RefeicaoFilter)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todas refeições</SelectItem>
            <SelectItem value="ALMOCO">Almoço</SelectItem>
            <SelectItem value="JANTAR">Jantar</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma escala de trabalho para este dia.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* AGUARDANDO */}
          {aguardando.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
                  <Clock className="h-4 w-4 text-amber-600" />
                  Aguardando bater ponto ({aguardando.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {aguardando.map((r) => (
                  <div
                    key={r.schedule_id}
                    className="flex items-center gap-3 border-b border-amber-100 last:border-b-0 py-3 px-4"
                  >
                    <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.employee_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{r.sector_name}</p>
                    </div>
                    <div className="text-sm text-right shrink-0">
                      Entrada: {r.scheduled_inicio_hora}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* PRESENTES + ATRASADOS */}
          {presentes.length > 0 && (
            <Card className="border-green-300 bg-green-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-900">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Presentes ({presentes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {presentes.map((r) => {
                  const atrasado = r.status === "ATRASO";
                  return (
                    <div
                      key={r.schedule_id}
                      className="flex items-center gap-3 border-b border-green-100 last:border-b-0 py-3 px-4"
                    >
                      {atrasado ? (
                        <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{r.employee_name}</p>
                        <p className="text-sm text-muted-foreground truncate">{r.sector_name}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm shrink-0">
                        <span className="text-muted-foreground hidden sm:inline">
                          Esperado: {r.scheduled_inicio_hora}
                        </span>
                        <span>Bateu: {r.punch_in_hora ?? "—"}</span>
                        {atrasado ? (
                          <Badge
                            variant="outline"
                            className="bg-yellow-50 text-yellow-700 border-yellow-300"
                          >
                            +{r.atraso_minutos ?? 0}min
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-300"
                          >
                            no horário
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* AUSENTES */}
          {ausentes.length > 0 && (
            <Card className="border-red-300 bg-red-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-900">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Ausentes ({ausentes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ausentes.map((r) => (
                  <div
                    key={r.schedule_id}
                    className="flex items-center gap-3 border-b border-red-100 last:border-b-0 py-3 px-4"
                  >
                    <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-red-900 truncate">{r.employee_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{r.sector_name}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm shrink-0">
                      <span className="text-muted-foreground hidden sm:inline">
                        Esperado: {r.scheduled_inicio_hora}
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-red-50 text-red-700 border-red-300"
                      >
                        sem batida
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
