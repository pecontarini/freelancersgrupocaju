import { useMemo, useState, type ReactNode } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip as RTooltip,
  ReferenceLine,
} from "recharts";
import { Crown, Medal, Award, Lock, ExternalLink, X, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  normalizeLojaCode,
  type RegistryItem,
  type RulesItem,
  type ConsolidatedItem,
} from "@/hooks/usePayoutSnapshot";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/19FL9uaJbmVxPiKHYMM6DRX51M9W8pFvrJt9qOljmUzQ";

const BRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtNum = (v: number | null | undefined, dec = 2) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: dec, minimumFractionDigits: 0 });

type Tier = "excelente" | "bom" | "basico" | "critico" | "none";

function tierFromDesc(desc: string | null | undefined): Tier {
  const d = (desc ?? "").toLowerCase();
  if (/excel|excepc/.test(d)) return "excelente";
  if (/bom/.test(d)) return "bom";
  if (/básic|basic/.test(d)) return "basico";
  if (/crític|critic|abaixo|acima/.test(d)) return "critico";
  return "none";
}

function rulePayout(r: RulesItem): number {
  return r.payout_brl ?? r.payout ?? 0;
}
function ruleBp(r: RulesItem): number | null {
  if (typeof r.breakpoint === "number") return r.breakpoint;
  if (typeof r.breakpoint === "string") {
    const n = parseFloat(r.breakpoint.replace(/[^\d.,-]/g, "").replace(",", "."));
    return isNaN(n) ? null : n;
  }
  return null;
}

const TIER_COLOR: Record<Tier, string> = {
  excelente: "#10B981",
  bom: "#3B82F6",
  basico: "#F59E0B",
  critico: "#EF4444",
  none: "#9CA3AF",
};

const TIER_LABEL: Record<Tier, string> = {
  excelente: "Excelente",
  bom: "Bom",
  basico: "Básico",
  critico: "Crítico",
  none: "Sem dado",
};

export interface IndicatorRankingTabProps {
  indicator: string;
  direction: "HIGH" | "LOW";
  description: string;
  brandFilter?: "Caminito" | "Nazo";
  registry: RegistryItem[];
  rules: RulesItem[];
  consolidated: ConsolidatedItem[];
  allLojas: { code: string; nome: string }[];
  isAdmin: boolean;
  isGerenteUnidade: boolean;
  userLojaCode?: string | null;
  accessibleLojaCodes: Set<string> | null;
  mesRef: string | null;
  /** Optional extra content to render in the drill-down modal, below the cargos list. */
  renderExtraDrillContent?: (lojaCode: string, lojaNome: string) => ReactNode;
}

export function IndicatorRankingTab({
  indicator,
  direction,
  description,
  brandFilter,
  registry,
  rules,
  consolidated,
  allLojas,
  isAdmin,
  isGerenteUnidade,
  userLojaCode,
  accessibleLojaCodes,
  mesRef,
  renderExtraDrillContent,
}: IndicatorRankingTabProps) {
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState<string | null>(null);
  const [drill, setDrill] = useState<string | null>(null);

  // Filter rules + registry for this indicator
  const indicatorRules = useMemo(
    () => rules.filter((r) => (r.indicador ?? r.meta) === indicator),
    [rules, indicator],
  );
  const indicatorRegistry = useMemo(
    () => registry.filter((r) => r.indicador === indicator),
    [registry, indicator],
  );

  // Cargos elegíveis + maior payout por cargo
  const cargosElegiveis = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of indicatorRules) {
      if (!r.cargo) continue;
      const cur = m.get(r.cargo) ?? 0;
      const v = rulePayout(r);
      if (v > cur) m.set(r.cargo, v);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [indicatorRules]);

  // Faixas únicas (breakpoint, descricao, payout)
  const faixas = useMemo(() => {
    const seen = new Map<string, { tier: Tier; descricao: string; payoutMax: number }>();
    for (const r of indicatorRules) {
      const key = r.descricao ?? "";
      if (!key) continue;
      const tier = tierFromDesc(r.descricao);
      const cur = seen.get(key);
      const p = rulePayout(r);
      if (!cur || p > cur.payoutMax) seen.set(key, { tier, descricao: key, payoutMax: p });
    }
    const arr = Array.from(seen.values());
    const order: Tier[] = ["excelente", "bom", "basico", "critico"];
    arr.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
    return arr;
  }, [indicatorRules]);

  // Brand filter on lojas list
  const filteredLojas = useMemo(() => {
    let list = allLojas;
    if (brandFilter === "Caminito") list = list.filter((l) => l.code.startsWith("CP_"));
    if (brandFilter === "Nazo") list = list.filter((l) => l.code.startsWith("NZ_"));
    if (accessibleLojaCodes && !isAdmin) {
      // Gerente_unidade vê tudo (decisão Pedro), operator filtra
      if (!isGerenteUnidade) {
        list = list.filter((l) => accessibleLojaCodes.has(normalizeLojaCode(l.code)));
      }
    }
    return list;
  }, [allLojas, brandFilter, accessibleLojaCodes, isAdmin, isGerenteUnidade]);

  // Aggregate per loja: pick "best" (highest payout) row for this indicator
  const perLoja = useMemo(() => {
    const map = new Map<string, { resultado: number | null; payout: number; tier: Tier; bpDesc: string | null }>();
    for (const code of filteredLojas.map((l) => l.code)) {
      const codeN = normalizeLojaCode(code);
      const rows = indicatorRegistry.filter((r) => normalizeLojaCode(r.loja_code) === codeN);
      if (rows.length === 0) {
        map.set(codeN, { resultado: null, payout: 0, tier: "none", bpDesc: null });
        continue;
      }
      // Use the row with highest payout as canonical
      const best = rows.reduce((a, b) => ((b.payout_brl ?? 0) > (a.payout_brl ?? 0) ? b : a));
      map.set(codeN, {
        resultado: best.resultado,
        payout: best.payout_brl ?? 0,
        tier: tierFromDesc(best.breakpoint_desc),
        bpDesc: best.breakpoint_desc,
      });
    }
    return map;
  }, [filteredLojas, indicatorRegistry]);

  // Ranking: order by resultado, respecting direction
  const ranking = useMemo(() => {
    const items = filteredLojas.map((l) => {
      const codeN = normalizeLojaCode(l.code);
      const d = perLoja.get(codeN)!;
      return { code: codeN, nome: l.nome, ...d };
    });
    items.sort((a, b) => {
      if (a.resultado == null && b.resultado == null) return 0;
      if (a.resultado == null) return 1;
      if (b.resultado == null) return -1;
      return direction === "HIGH" ? b.resultado - a.resultado : a.resultado - b.resultado;
    });
    return items.map((it, i) => ({ ...it, posicao: i + 1 }));
  }, [filteredLojas, perLoja, direction]);

  const userN = userLojaCode ? normalizeLojaCode(userLojaCode) : null;
  const userRow = userN ? ranking.find((r) => r.code === userN) : null;

  // Próxima faixa para o user
  const proximaFaixa = useMemo(() => {
    if (!userRow || userRow.resultado == null) return null;
    const bps = indicatorRules
      .map((r) => ({ ...r, _bp: ruleBp(r), _pay: rulePayout(r) }))
      .filter((r) => r._bp != null && r._pay > userRow.payout)
      .sort((a, b) =>
        direction === "HIGH" ? (a._bp as number) - (b._bp as number) : (b._bp as number) - (a._bp as number),
      );
    const next = bps[0];
    if (!next || next._bp == null) return null;
    const gap = direction === "HIGH" ? next._bp - userRow.resultado : userRow.resultado - next._bp;
    return { gap: Math.abs(gap), payout: next._pay, desc: next.descricao };
  }, [userRow, indicatorRules, direction]);

  const drillItems = useMemo(() => {
    if (!drill) return [];
    return indicatorRegistry.filter((r) => normalizeLojaCode(r.loja_code) === drill);
  }, [drill, indicatorRegistry]);
  const drillLoja = ranking.find((r) => r.code === drill);
  const drillTotal = drillItems.reduce((a, r) => a + (r.payout_brl ?? 0), 0);

  // Stats da rede
  const stats = useMemo(() => {
    const valores = ranking.map((r) => r.resultado).filter((v): v is number => v != null);
    if (valores.length === 0) return null;
    const sorted = [...valores].sort((a, b) => a - b);
    const mediana = sorted[Math.floor(sorted.length / 2)];
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    return { media, mediana, n: valores.length };
  }, [ranking]);

  const canDrill = (code: string) =>
    isAdmin || (isGerenteUnidade ? code === userN : true);

  const handleClickLoja = (code: string) => {
    if (canDrill(code)) setDrill(code);
  };

  const top3 = ranking.slice(0, 3).filter((r) => r.resultado != null);
  const podiumOrdered = [top3[1], top3[0], top3[2]].filter(Boolean);

  // Chart data — show all lojas; null becomes 0 for bar but with low opacity
  const chartData = ranking.map((r) => ({
    code: r.code,
    nome: r.nome.length > 16 ? r.nome.slice(0, 14) + "…" : r.nome,
    resultado: r.resultado ?? 0,
    hasData: r.resultado != null,
    tier: r.tier,
  }));

  const numericBreakpoints = indicatorRules
    .map((r) => ({ value: ruleBp(r), label: tierFromDesc(r.descricao) }))
    .filter((b): b is { value: number; label: Tier } => b.value != null);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="glass-card p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight">
                  {indicator}
                </h2>
                <Badge variant="outline" className="text-[10px]">
                  {direction === "HIGH" ? "Quanto maior, melhor" : "Quanto menor, melhor"}
                </Badge>
                {brandFilter && <Badge variant="secondary" className="text-[10px]">{brandFilter}</Badge>}
                {mesRef && <Badge variant="outline" className="text-[10px]">{mesRef}</Badge>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground flex items-start gap-1.5 max-w-3xl">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                {description}
              </p>
            </div>
          </div>

          {/* Cargos elegíveis */}
          {cargosElegiveis.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                Cargos elegíveis
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cargosElegiveis.map(([cargo, payout]) => (
                  <Badge key={cargo} variant="outline" className="font-normal">
                    {cargo} · até {BRL(payout)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Faixas */}
          {faixas.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                Faixas de payout
              </div>
              <div className="flex flex-wrap gap-1.5">
                {faixas.map((f) => (
                  <span
                    key={f.descricao}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border"
                    style={{ borderColor: TIER_COLOR[f.tier] + "55", color: TIER_COLOR[f.tier], background: TIER_COLOR[f.tier] + "12" }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_COLOR[f.tier] }} />
                    {f.descricao} · {BRL(f.payoutMax)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Card "Seu desempenho" */}
        {isGerenteUnidade && userRow && (
          <div className="glass-card p-4 md:p-5 border-l-4" style={{ borderLeftColor: TIER_COLOR[userRow.tier] }}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Seu desempenho
            </div>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="font-bold text-lg">{userRow.nome}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Posição {userRow.posicao}º de {ranking.length} ·{" "}
                  <span style={{ color: TIER_COLOR[userRow.tier] }}>{TIER_LABEL[userRow.tier]}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">{fmtNum(userRow.resultado)}</div>
                <div className="text-xs text-emerald-600 font-semibold">{BRL(userRow.payout)}</div>
              </div>
            </div>
            {proximaFaixa && (
              <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-xs">
                Faltam <span className="font-bold tabular-nums">{fmtNum(proximaFaixa.gap)}</span> para
                a próxima faixa <span className="font-semibold">({proximaFaixa.desc})</span> ={" "}
                <span className="font-bold text-emerald-600">+{BRL(proximaFaixa.payout - userRow.payout)}</span>
              </div>
            )}
          </div>
        )}

        {/* Pódio */}
        {top3.length > 0 && (
          <div className="glass-card p-4 md:p-5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Pódio
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              {podiumOrdered.map((it) => {
                const isFirst = it.posicao === 1;
                const Icon = it.posicao === 1 ? Crown : it.posicao === 2 ? Medal : Award;
                return (
                  <div
                    key={it.code}
                    onClick={() => handleClickLoja(it.code)}
                    className={`rounded-xl p-3 text-center border cursor-pointer transition ${
                      isFirst
                        ? "bg-amber-500 border-amber-400 text-black scale-105 shadow-lg"
                        : "bg-card border-border/50 hover:border-primary/40"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 mx-auto mb-1 ${
                        isFirst ? "text-black" : it.posicao === 2 ? "text-slate-400" : "text-orange-500"
                      }`}
                    />
                    <div className={`text-xs font-bold truncate ${isFirst ? "text-black/80" : "text-muted-foreground"}`}>
                      {it.nome}
                    </div>
                    <div className={`text-lg font-bold tabular-nums ${isFirst ? "text-black" : "text-foreground"}`}>
                      {fmtNum(it.resultado)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ranking + Gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ranking lista */}
          <div className="glass-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Ranking completo ({ranking.length})
            </div>
            <div className="space-y-1.5">
              {ranking.map((it) => {
                const isUser = it.code === userN;
                const blocked = !canDrill(it.code);
                const color = TIER_COLOR[it.tier];
                const max = Math.max(...ranking.map((r) => r.resultado ?? 0), 1);
                const pct = it.resultado != null ? Math.min((it.resultado / max) * 100, 100) : 0;
                const RowContent = (
                  <div
                    onMouseEnter={() => setHovered(it.code)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleClickLoja(it.code)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition ${
                      blocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                    } ${
                      isUser
                        ? "bg-primary/10 border-primary/40"
                        : hovered === it.code
                        ? "bg-muted border-border"
                        : "bg-card/50 border-border/30 hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-xs font-mono text-muted-foreground w-6 text-right">{it.posicao}º</span>
                    <span className="text-sm font-medium flex-1 truncate">{it.nome}</span>
                    <div className="hidden sm:block flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-sm font-semibold tabular-nums w-16 text-right" style={{ color }}>
                      {fmtNum(it.resultado)}
                    </span>
                    {blocked && <Lock className="h-3 w-3 text-muted-foreground/50" />}
                  </div>
                );
                return blocked ? (
                  <Tooltip key={it.code}>
                    <TooltipTrigger asChild>{RowContent}</TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="text-xs">Você só pode ver detalhes da sua loja.</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={it.code}>{RowContent}</div>
                );
              })}
            </div>
          </div>

          {/* Gráfico */}
          <div className="glass-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Visualização · breakpoints
            </div>
            <div style={{ width: "100%", height: Math.max(280, ranking.length * 28) }}>
              <ResponsiveContainer>
                <BarChart layout="vertical" data={chartData} margin={{ left: 0, right: 30, top: 5, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={120}
                    tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number, _n, p: any) => [
                      p.payload.hasData ? fmtNum(v) : "—",
                      indicator,
                    ]}
                  />
                  {numericBreakpoints.map((bp, i) => (
                    <ReferenceLine
                      key={i}
                      x={bp.value}
                      stroke={TIER_COLOR[bp.label]}
                      strokeDasharray="3 3"
                      strokeOpacity={0.6}
                    />
                  ))}
                  <Bar
                    dataKey="resultado"
                    radius={[0, 4, 4, 0]}
                    onClick={(d: any) => handleClickLoja(d.code)}
                    cursor="pointer"
                  >
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={TIER_COLOR[d.tier]}
                        opacity={hovered && hovered !== d.code ? 0.35 : d.hasData ? 1 : 0.2}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Drill-down */}
        <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
          <DialogContent className={isMobile ? "h-[100dvh] max-w-full rounded-none p-0" : "max-w-2xl"}>
            <DialogHeader className="p-4 border-b">
              <DialogTitle className="font-display uppercase">
                {drillLoja?.nome} · {indicator} · {mesRef}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className={isMobile ? "h-[calc(100dvh-160px)]" : "max-h-[60vh]"}>
              <div className="p-4 space-y-3">
                {/* Por que esse valor */}
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
                  <div className="font-semibold mb-1 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" /> Por que esse valor?
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{description}</p>
                  {drillLoja && drillLoja.resultado != null && (
                    <p className="mt-2">
                      Resultado da loja: <span className="font-bold">{fmtNum(drillLoja.resultado)}</span> →{" "}
                      <span style={{ color: TIER_COLOR[drillLoja.tier] }} className="font-semibold">
                        {drillLoja.bpDesc ?? TIER_LABEL[drillLoja.tier]}
                      </span>
                    </p>
                  )}
                </div>

                {/* Comparação rede */}
                {stats && drillLoja && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <div className="text-[10px] text-muted-foreground uppercase">Posição</div>
                      <div className="font-bold">
                        {drillLoja.posicao}º / {ranking.length}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <div className="text-[10px] text-muted-foreground uppercase">Média rede</div>
                      <div className="font-bold tabular-nums">{fmtNum(stats.media)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <div className="text-[10px] text-muted-foreground uppercase">Mediana</div>
                      <div className="font-bold tabular-nums">{fmtNum(stats.mediana)}</div>
                    </div>
                  </div>
                )}

                {/* Quem recebe payout */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Quem recebe payout nesta loja
                  </div>
                  {drillItems.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nenhum colaborador registrado.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    {drillItems.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border bg-card/50 p-2.5"
                      >
                        <div>
                          <div className="font-semibold text-sm">{r.cargo}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.breakpoint_desc ?? "—"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {fmtNum(r.resultado)}
                          </div>
                          <div className="font-bold text-emerald-600 tabular-nums">
                            {BRL(r.payout_brl)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {drill && drillLoja && renderExtraDrillContent?.(drill, drillLoja.nome)}
              </div>
            </ScrollArea>
            <div className="border-t p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Total nesta loja:</span>{" "}
                <span className="font-bold text-lg">{BRL(drillTotal)}</span>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={SHEET_URL} target="_blank" rel="noreferrer" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Planilha
                  </a>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDrill(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
