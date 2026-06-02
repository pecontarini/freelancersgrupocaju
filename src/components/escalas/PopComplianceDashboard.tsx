import { useMemo, useState } from "react";
import { format, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { usePopDiario, type PopDiarioRow } from "@/hooks/usePopDiario";

type Periodo = "7" | "30" | "90";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function useLookups() {
  return useQuery({
    queryKey: ["pop-dashboard-lookups"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [{ data: units }, { data: sectors }] = await Promise.all([
        supabase.from("config_lojas").select("id, nome").order("nome"),
        supabase.from("sectors").select("id, name").order("name"),
      ]);
      const u = new Map<string, string>();
      for (const r of (units as any[]) || []) u.set(r.id, r.nome);
      const s = new Map<string, string>();
      for (const r of (sectors as any[]) || []) s.set(r.id, r.name);
      return { units: u, sectors: s };
    },
  });
}

function heatColor(pct: number): string {
  // pct = % de inconformidade (quanto maior, mais vermelho)
  if (pct <= 0) return "bg-green-100";
  if (pct < 15) return "bg-green-200";
  if (pct < 30) return "bg-yellow-200";
  if (pct < 50) return "bg-orange-300";
  return "bg-red-400";
}

export function PopComplianceDashboard() {
  const lojas = useConfigLojas();
  const lookups = useLookups();
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const dias = parseInt(periodo, 10);
  const from = useMemo(() => format(subDays(new Date(), dias - 1), "yyyy-MM-dd"), [dias]);
  const fromPrev = useMemo(() => format(subDays(new Date(), dias * 2 - 1), "yyyy-MM-dd"), [dias]);
  const toPrev = useMemo(() => format(subDays(new Date(), dias), "yyyy-MM-dd"), [dias]);

  const pop = usePopDiario({
    date: { from, to: today },
    unitId: selectedUnits.length > 0 ? selectedUnits : undefined,
  });

  const popPrev = usePopDiario({
    date: { from: fromPrev, to: toPrev },
    unitId: selectedUnits.length > 0 ? selectedUnits : undefined,
  });

  const storeOptions = useMemo(
    () => lojas.options.map((l) => ({ value: l.id, label: l.nome })),
    [lojas.options],
  );

  // ── Agregados ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const rows = pop.rows.filter((r) => !r.sem_pop);

    // Conformidade média do período
    let popMin = 0;
    let popChegou = 0;
    for (const r of rows) {
      popMin += r.pop_minimo;
      popChegou += r.pop_chegou;
    }
    const conformidadeMedia = popMin > 0 ? Math.round((popChegou / popMin) * 100) : 0;

    // Conformidade do período anterior (para a seta de tendência)
    let popMinPrev = 0;
    let popChegouPrev = 0;
    for (const r of popPrev.rows) {
      if (r.sem_pop) continue;
      popMinPrev += r.pop_minimo;
      popChegouPrev += r.pop_chegou;
    }
    const conformidadePrev = popMinPrev > 0 ? Math.round((popChegouPrev / popMinPrev) * 100) : 0;
    const deltaConformidade = conformidadeMedia - conformidadePrev;

    // Setores críticos = (sector+turno) com >=50% dos dias inconforme
    const sectorAgg = new Map<
      string,
      { sectorId: string; turno: string; total: number; inconforme: number }
    >();
    for (const r of rows) {
      const k = `${r.sector_id}__${r.turno}`;
      if (!sectorAgg.has(k))
        sectorAgg.set(k, { sectorId: r.sector_id, turno: r.turno, total: 0, inconforme: 0 });
      const a = sectorAgg.get(k)!;
      a.total += 1;
      if (r.status === "inconforme") a.inconforme += 1;
    }
    let setoresCriticos = 0;
    for (const [, a] of sectorAgg) {
      if (a.total >= 3 && a.inconforme / a.total >= 0.5) setoresCriticos += 1;
    }

    // Faltantes recorrentes (>= 3 ausências)
    const ausenciasPorPessoa = new Map<
      string,
      { name: string; faltas: number; atrasos: number; ultimaFalta: string; sectorIds: Set<string> }
    >();
    for (const r of rows) {
      const presentesIds = new Set(r.presentes_lista.map((p) => p.employee_id));
      for (const esc of r.escalados_lista) {
        const presente = presentesIds.has(esc.employee_id);
        let bucket = ausenciasPorPessoa.get(esc.employee_id);
        if (!bucket) {
          bucket = {
            name: esc.name,
            faltas: 0,
            atrasos: 0,
            ultimaFalta: "",
            sectorIds: new Set(),
          };
          ausenciasPorPessoa.set(esc.employee_id, bucket);
        }
        bucket.sectorIds.add(r.sector_id);
        if (!presente) {
          bucket.faltas += 1;
          if (r.schedule_date > bucket.ultimaFalta) bucket.ultimaFalta = r.schedule_date;
        } else if ((esc.atraso_min ?? 0) > 15) {
          bucket.atrasos += 1;
        }
      }
    }
    let faltantesRecorrentes = 0;
    for (const [, b] of ausenciasPorPessoa) if (b.faltas >= 3) faltantesRecorrentes += 1;

    // Top faltantes
    const topFaltantes = [...ausenciasPorPessoa.entries()]
      .map(([id, b]) => ({ id, ...b }))
      .filter((b) => b.faltas > 0)
      .sort((a, b) => b.faltas - a.faltas)
      .slice(0, 10);

    // Horas-extras aproximadas (atraso_min total / 60)
    let atrasoMinTotal = 0;
    for (const r of rows) {
      for (const esc of r.escalados_lista) {
        if ((esc.atraso_min ?? 0) > 0) atrasoMinTotal += esc.atraso_min ?? 0;
      }
    }
    const horasAtrasoAprox = Math.round(atrasoMinTotal / 60);

    return {
      conformidadeMedia,
      deltaConformidade,
      setoresCriticos,
      faltantesRecorrentes,
      horasAtrasoAprox,
      topFaltantes,
    };
  }, [pop.rows, popPrev.rows]);

  // ── Tendência diária por unidade ───────────────────────────
  const tendencia = useMemo(() => {
    if (lookups.isLoading || !lookups.data) return { data: [], unitKeys: [] as string[] };
    // agrega por dia (overall) e por unidade
    const overall = new Map<string, { pop: number; chegou: number }>();
    const perUnit = new Map<string, Map<string, { pop: number; chegou: number }>>();
    const unitNames = new Set<string>();
    for (const r of pop.rows) {
      if (r.sem_pop) continue;
      if (!overall.has(r.schedule_date)) overall.set(r.schedule_date, { pop: 0, chegou: 0 });
      const o = overall.get(r.schedule_date)!;
      o.pop += r.pop_minimo;
      o.chegou += r.pop_chegou;

      if (!perUnit.has(r.unit_id)) perUnit.set(r.unit_id, new Map());
      const u = perUnit.get(r.unit_id)!;
      if (!u.has(r.schedule_date)) u.set(r.schedule_date, { pop: 0, chegou: 0 });
      const ud = u.get(r.schedule_date)!;
      ud.pop += r.pop_minimo;
      ud.chegou += r.pop_chegou;
      const name = lookups.data!.units.get(r.unit_id) ?? "Unidade";
      unitNames.add(name);
    }
    // datas ordenadas
    const dates = [...overall.keys()].sort();
    const data = dates.map((d) => {
      const row: Record<string, any> = {
        date: d,
        label: format(addDays(new Date(`${d}T12:00:00`), 0), "dd/MM"),
        Geral:
          overall.get(d)!.pop > 0
            ? Math.round((overall.get(d)!.chegou / overall.get(d)!.pop) * 100)
            : null,
      };
      // só inclui unidades se houver poucas selecionadas (clutter)
      if (selectedUnits.length > 0 && selectedUnits.length <= 4) {
        for (const uid of selectedUnits) {
          const name = lookups.data!.units.get(uid) ?? "Unidade";
          const ud = perUnit.get(uid)?.get(d);
          row[name] = ud && ud.pop > 0 ? Math.round((ud.chegou / ud.pop) * 100) : null;
        }
      }
      return row;
    });
    const unitKeys =
      selectedUnits.length > 0 && selectedUnits.length <= 4
        ? selectedUnits.map((uid) => lookups.data!.units.get(uid) ?? "Unidade")
        : [];
    return { data, unitKeys };
  }, [pop.rows, lookups.data, lookups.isLoading, selectedUnits]);

  // ── Heatmap setor × dia da semana ──────────────────────────
  const heatmap = useMemo(() => {
    if (!lookups.data) return [] as Array<{ sectorName: string; cells: number[]; totals: number[] }>;
    // map: sectorId -> [dow -> { total, inconforme }]
    const m = new Map<string, { sectorName: string; cells: Array<{ t: number; bad: number }> }>();
    for (const r of pop.rows) {
      if (r.sem_pop) continue;
      const sectorName = lookups.data.sectors.get(r.sector_id) ?? r.sector_id.slice(0, 8);
      if (!m.has(r.sector_id))
        m.set(r.sector_id, {
          sectorName,
          cells: Array.from({ length: 7 }, () => ({ t: 0, bad: 0 })),
        });
      const dow = new Date(`${r.schedule_date}T12:00:00`).getDay();
      const cell = m.get(r.sector_id)!.cells[dow];
      cell.t += 1;
      if (r.status === "inconforme") cell.bad += 1;
    }
    // top 12 setores com mais inconformidades totais
    return [...m.values()]
      .map((s) => {
        const totals = s.cells.map((c) => c.t);
        const cells = s.cells.map((c) => (c.t > 0 ? Math.round((c.bad / c.t) * 100) : -1));
        const totalBad = s.cells.reduce((acc, c) => acc + c.bad, 0);
        return { ...s, cells, totals, totalBad };
      })
      .sort((a, b) => b.totalBad - a.totalBad)
      .slice(0, 12);
  }, [pop.rows, lookups.data]);

  // ── Inconformidades de hoje (para ação) ────────────────────
  const inconformidadesHoje = useMemo(() => {
    if (!lookups.data) return [] as Array<{ key: string; unitName: string; sectorName: string; turno: string; faltam: number }>;
    const out: Array<{ key: string; unitName: string; sectorName: string; turno: string; faltam: number; row: PopDiarioRow }> = [];
    for (const r of pop.rows) {
      if (r.schedule_date !== today) continue;
      if (r.status !== "inconforme") continue;
      out.push({
        key: `${r.unit_id}-${r.sector_id}-${r.turno}`,
        unitName: lookups.data.units.get(r.unit_id) ?? "",
        sectorName: lookups.data.sectors.get(r.sector_id) ?? "",
        turno: r.turno === "ALMOCO" ? "Almoço" : "Jantar",
        faltam: Math.max(0, -r.saldo_final),
        row: r,
      });
    }
    return out.sort((a, b) => b.faltam - a.faltam);
  }, [pop.rows, today, lookups.data]);

  const isLoading = pop.isLoading || lookups.isLoading;

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Dashboard POP — Conformidade
        </h2>
        <p className="text-muted-foreground text-sm">
          Tendência de aderência ao POP por unidade, setor e dia.
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Unidade</label>
            <MultiSelect
              options={storeOptions}
              selected={selectedUnits}
              onChange={setSelectedUnits}
              placeholder="Todas as unidades"
              className="w-[260px]"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* LINHA 1 — KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI
              title="Conformidade média"
              value={`${stats.conformidadeMedia}%`}
              delta={stats.deltaConformidade}
              icon={<CheckCircle2 className="h-5 w-5" />}
              color="text-green-600"
            />
            <KPI
              title="Setores críticos"
              value={stats.setoresCriticos}
              subtitle="≥50% dos dias inconformes"
              icon={<AlertTriangle className="h-5 w-5" />}
              color="text-red-600"
            />
            <KPI
              title="Faltantes recorrentes"
              value={stats.faltantesRecorrentes}
              subtitle="≥3 ausências no período"
              icon={<Users className="h-5 w-5" />}
              color="text-orange-600"
            />
            <KPI
              title="Atraso acumulado"
              value={`${stats.horasAtrasoAprox}h`}
              subtitle="Soma de atrasos > 0min"
              icon={<TrendingUp className="h-5 w-5" />}
              color="text-amber-600"
            />
          </div>

          {/* LINHA 2 — Tendência */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tendência de conformidade</CardTitle>
              <p className="text-xs text-muted-foreground">
                % POP atendido por dia. Selecione até 4 unidades para comparar linhas.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tendencia.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis domain={[0, 100]} fontSize={11} unit="%" />
                    <Tooltip formatter={(v: any) => (v == null ? "—" : `${v}%`)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="Geral"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                    {tendencia.unitKeys.map((name, idx) => {
                      const colors = ["#16a34a", "#dc2626", "#2563eb", "#ca8a04"];
                      return (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={colors[idx % colors.length]}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* LINHA 3 — Heatmap setor × dia da semana */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Heatmap — setores que mais falham</CardTitle>
              <p className="text-xs text-muted-foreground">
                Cor = % de dias inconformes naquele setor / dia da semana. Verde = ok, vermelho =
                crítico.
              </p>
            </CardHeader>
            <CardContent>
              {heatmap.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sem inconformidades no período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left font-medium pb-2 pr-3 min-w-[180px]">Setor</th>
                        {DAY_LABELS.map((d) => (
                          <th key={d} className="text-center font-medium pb-2 px-1 min-w-[50px]">
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.map((s, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-1.5 pr-3 truncate max-w-[220px]">{s.sectorName}</td>
                          {s.cells.map((pct, dow) => (
                            <td key={dow} className="px-1 py-1.5">
                              <div
                                className={cn(
                                  "h-7 rounded flex items-center justify-center text-[10px] font-semibold",
                                  pct < 0 ? "bg-muted text-muted-foreground" : heatColor(pct),
                                )}
                                title={
                                  pct < 0
                                    ? "sem dados"
                                    : `${pct}% inconformes em ${s.totals[dow]} dia(s)`
                                }
                              >
                                {pct < 0 ? "—" : `${pct}%`}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex gap-3 text-[10px] text-muted-foreground mt-3 pt-2 border-t">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-100 border" /> 0%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-yellow-200" /> &lt;30%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-orange-300" /> &lt;50%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-400" /> ≥50%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* LINHA 4 — Top faltantes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 10 faltantes recorrentes</CardTitle>
              <p className="text-xs text-muted-foreground">Funcionários CLT com mais ausências no período.</p>
            </CardHeader>
            <CardContent className="p-0">
              {stats.topFaltantes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum faltante no período. 🎯
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead className="text-center">Ausências</TableHead>
                      <TableHead className="text-center">Atrasos &gt;15min</TableHead>
                      <TableHead>Última falta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topFaltantes.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              f.faltas >= 5
                                ? "bg-red-100 text-red-700 border-red-300"
                                : f.faltas >= 3
                                ? "bg-orange-100 text-orange-700 border-orange-300"
                                : "bg-yellow-50 text-yellow-700 border-yellow-300",
                            )}
                          >
                            {f.faltas}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {f.atrasos}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {f.ultimaFalta
                            ? format(new Date(`${f.ultimaFalta}T12:00:00`), "dd MMM", {
                                locale: ptBR,
                              })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* LINHA 5 — Inconformidades de hoje */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Inconformidades de hoje
                {inconformidadesHoje.length > 0 && (
                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                    {inconformidadesHoje.length}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Setores que precisam de ação imediata. Abra o Quadro Operacional para drill-down.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {inconformidadesHoje.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhuma inconformidade ativa agora. 🎉
                </p>
              ) : (
                <ul className="divide-y">
                  {inconformidadesHoje.slice(0, 20).map((i) => (
                    <li
                      key={i.key}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/30"
                    >
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{i.sectorName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {i.unitName} · {i.turno}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-red-50 text-red-700 border-red-300 shrink-0"
                      >
                        faltam {i.faltam}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({
  title,
  value,
  subtitle,
  delta,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  delta?: number;
  icon: React.ReactNode;
  color: string;
}) {
  const DeltaIcon = delta == null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor =
    delta == null
      ? ""
      : delta > 0
      ? "text-green-600"
      : delta < 0
      ? "text-red-600"
      : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg bg-muted", color)}>{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{title}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
            {DeltaIcon && (
              <p className={cn("text-[11px] mt-1 flex items-center gap-0.5", deltaColor)}>
                <DeltaIcon className="h-3 w-3" />
                {delta! > 0 ? "+" : ""}
                {delta}pp vs período anterior
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
