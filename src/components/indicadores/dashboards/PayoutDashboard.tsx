import { useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, ExternalLink, X, Trophy, Zap, Flame, Fish, TrendingUp, BarChart3, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  usePayoutSnapshot,
  normalizeLojaCode,
  type ConsolidatedItem,
  type RegistryItem,
} from "@/hooks/usePayoutSnapshot";
import { useUserProfile } from "@/hooks/useUserProfile";
import { lojaCodigoFromNome } from "@/components/dashboard/painel-metas/shared/lojaMapping";
import { IndicatorRankingTab } from "./IndicatorRankingTab";
import { SupervisoresRankingTab } from "./SupervisoresRankingTab";
import { SalmaoDiarioDrillContent } from "./SalmaoDiarioDrillContent";

const INDICATORS: {
  id: string;
  label: string;
  direction: "HIGH" | "LOW";
  description: string;
  brandFilter?: "Caminito" | "Nazo";
  icon: typeof Trophy;
  group: "atendimento" | "operacao" | "budgets";
}[] = [
  { id: "NPS Salão", label: "NPS Salão", direction: "HIGH", icon: Trophy, group: "atendimento",
    description: "Mede a qualidade do atendimento presencial através de reclamações. Quanto maior o R$ faturado por avaliação 1-3, melhor a experiência do cliente." },
  { id: "NPS Delivery", label: "NPS Delivery", direction: "HIGH", icon: Trophy, group: "atendimento",
    description: "R$ faturado por avaliação 1-3 no canal delivery. Mede a percepção do cliente após receber o pedido em casa." },
  { id: "Conformidade", label: "Conformidade", direction: "HIGH", icon: Trophy, group: "atendimento",
    description: "Mede a aderência aos POPs operacionais via checklist supervisionado. Quanto maior o %, melhor a disciplina operacional." },
  { id: "Tempo de Prato", label: "Tempo de Prato", direction: "LOW", icon: Zap, group: "operacao",
    description: "Tempo médio do pedido na cozinha vs. target. Quanto menor o desvio acima do target, melhor." },
  { id: "Tempo Delivery", label: "Tempo Delivery", direction: "LOW", icon: Zap, group: "operacao",
    description: "Tempo médio entre pedido e saída do delivery. Quanto menor, melhor a operação." },
  { id: "CMV", label: "CMV", direction: "LOW", icon: TrendingUp, group: "budgets",
    description: "Custo da mercadoria vendida sobre faturamento. Quanto menor o %, maior a margem." },
  { id: "CMV CAMINITO", label: "CMV Caminito", direction: "LOW", brandFilter: "Caminito", icon: Flame, group: "budgets",
    description: "Diferença % entre carne pesada no destino e carne transferida do CPD. Quanto menor a diferença, melhor o controle de quebra." },
  { id: "CMV NAZO", label: "CMV Nazo", direction: "LOW", brandFilter: "Nazo", icon: Fish, group: "budgets",
    description: "kg de salmão consumido por R$1.000 vendido. Quanto menor, melhor o aproveitamento do insumo." },
  { id: "Budget", label: "Budget", direction: "HIGH", icon: TrendingUp, group: "budgets",
    description: "% de economia ou excesso sobre o orçado. Quanto maior a economia, melhor a gestão de despesa." },
];

const SHEET_URL = "https://docs.google.com/spreadsheets/d/19FL9uaJbmVxPiKHYMM6DRX51M9W8pFvrJt9qOljmUzQ";

const BRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function relTime(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "agora há pouco";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return d.toLocaleString("pt-BR");
}

function breakpointVariant(desc: string | null | undefined): { cls: string; label: string } {
  const d = (desc ?? "").toLowerCase();
  if (/excel|excepc/.test(d)) return { cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", label: "Excelente" };
  if (/bom/.test(d)) return { cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30", label: "Bom" };
  if (/básic|basic/.test(d)) return { cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", label: "Básico" };
  if (/crític|critic|abaixo/.test(d)) return { cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30", label: "Crítico" };
  return { cls: "bg-muted text-muted-foreground border-border", label: "—" };
}

interface DrillDown { lojaCode: string; lojaNome: string; cargo: string; }

export function PayoutDashboard() {
  const { data, loading, error, syncing, syncAll } = usePayoutSnapshot();
  const { isAdmin, isOperator, isGerenteUnidade, unidades } = useUserProfile();
  const isMobile = useIsMobile();
  const [drill, setDrill] = useState<DrillDown | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  // RBAC: list of loja_codes the user can see
  const allowedCodes = useMemo<Set<string> | null>(() => {
    if (isAdmin) return null;
    if ((isOperator || isGerenteUnidade) && unidades.length > 0) {
      const set = new Set<string>();
      for (const u of unidades) {
        const c = lojaCodigoFromNome(u.nome);
        if (c) set.add(normalizeLojaCode(c));
        // include itaim → CJ_SP fallback
        if (/ITAIM/i.test(u.nome)) set.add("CJ_SP");
      }
      return set;
    }
    return new Set();
  }, [isAdmin, isOperator, isGerenteUnidade, unidades]);

  const filterCode = (code: string | null | undefined) => {
    if (!allowedCodes) return true;
    return allowedCodes.has(normalizeLojaCode(code));
  };

  const consolidated = useMemo<ConsolidatedItem[]>(
    () => (data?.consolidated ?? []).filter((c) => filterCode(c.loja_code)),
    [data, allowedCodes]
  );

  const registry = useMemo<RegistryItem[]>(
    () => (data?.registry ?? []).filter((r) => filterCode(r.loja_code)),
    [data, allowedCodes]
  );

  // Build matrix: lojas × cargos
  const { lojas, cargos, matrix } = useMemo(() => {
    const lojaMap = new Map<string, string>(); // code → nome
    const cargoSet = new Set<string>();
    const m = new Map<string, ConsolidatedItem>(); // key = code|cargo

    for (const item of consolidated) {
      const code = normalizeLojaCode(item.loja_code);
      if (!code) continue;
      lojaMap.set(code, item.loja_nome ?? code);
      cargoSet.add(item.cargo);
      m.set(`${code}|${item.cargo}`, item);
    }

    // Stable order: by loja_nome, cargo manual ordering
    const cargoOrder = [
      "Gerente Front", "Gerente Back", "Gerente CPD",
      "Chefe de Salão", "Chefe de Bar", "Chefe de APV",
      "Chefe de Cozinha", "Chefe de Sushi", "Chefe de Parrilla",
    ];
    const cargosArr = Array.from(cargoSet).sort((a, b) => {
      const ia = cargoOrder.indexOf(a); const ib = cargoOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    const lojasArr = Array.from(lojaMap.entries())
      .map(([code, nome]) => ({ code, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { lojas: lojasArr, cargos: cargosArr, matrix: m };
  }, [consolidated]);

  // KPIs
  const kpis = useMemo(() => {
    let total = 0, lojasFull = 0, lojasCriticas = 0, colaboradores = 0;
    for (const l of lojas) {
      let lojaTotal = 0, payoutCount = 0, totalSlots = 0, zeroCount = 0;
      for (const c of cargos) {
        const cell = matrix.get(`${l.code}|${c}`);
        if (!cell) continue;
        totalSlots++;
        if (cell.payout_total_brl != null) {
          colaboradores++;
          lojaTotal += cell.payout_total_brl;
          if (cell.payout_total_brl > 0) payoutCount++;
          else zeroCount++;
        }
      }
      total += lojaTotal;
      if (totalSlots > 0 && payoutCount === totalSlots) lojasFull++;
      if (zeroCount >= 3) lojasCriticas++;
    }
    return { total, lojasFull, lojasCriticas, colaboradores, totalLojas: lojas.length };
  }, [lojas, cargos, matrix]);

  // Lista completa de lojas (sem RBAC) — usada pelo IndicatorRankingTab
  const allLojas = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data?.consolidated ?? []) {
      const code = normalizeLojaCode(c.loja_code);
      if (code) map.set(code, c.loja_nome ?? code);
    }
    for (const r of data?.registry ?? []) {
      const code = normalizeLojaCode(r.loja_code);
      if (code && !map.has(code)) map.set(code, r.loja_nome ?? code);
    }
    return Array.from(map.entries())
      .map(([code, nome]) => ({ code, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [data]);

  // Loja do gerente_unidade
  const userLojaCode = useMemo<string | null>(() => {
    if (!isGerenteUnidade) return null;
    for (const u of unidades) {
      const c = lojaCodigoFromNome(u.nome);
      if (c) return normalizeLojaCode(c);
    }
    return null;
  }, [isGerenteUnidade, unidades]);

  const handleSync = async () => {
    try {
      await syncAll();
      toast.success("Sincronização concluída");
    } catch (e: any) {
      toast.error("Falha ao sincronizar", { description: e?.message });
    }
  };

  const drillItems = useMemo<RegistryItem[]>(() => {
    if (!drill) return [];
    return registry.filter(
      (r) => normalizeLojaCode(r.loja_code) === drill.lojaCode && r.cargo === drill.cargo
    );
  }, [drill, registry]);

  const drillTotal = drillItems.reduce((acc, r) => acc + (r.payout_brl ?? 0), 0);

  if (loading) {
    return (
      <div className="glass-card p-12 text-center text-sm text-muted-foreground">
        Carregando snapshot…
      </div>
    );
  }
  if (error) {
    return (
      <div className="glass-card p-6 text-sm text-destructive">
        <AlertCircle className="inline h-4 w-4 mr-2" /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
            Painel de Metas Variáveis · {data?.mes_ref ?? "—"}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Último sync: {relTime(data?.last_sync ?? null)}
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Payout total" value={BRL(kpis.total)} accent="emerald" />
        <KpiCard label="Lojas com 100%" value={`${kpis.lojasFull} de ${kpis.totalLojas}`} accent="blue" />
        <KpiCard label="Lojas críticas" value={String(kpis.lojasCriticas)} hint="3+ metas zeradas" accent="red" />
        <KpiCard label="Colaboradores elegíveis" value={String(kpis.colaboradores)} accent="amber" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="w-full">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto p-1 gap-1">
            <TabsTrigger value="geral" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Geral
            </TabsTrigger>
            <span className="px-2 text-xs text-muted-foreground self-center">·</span>
            {INDICATORS.filter((i) => i.group === "atendimento").map((i) => (
              <TabsTrigger key={i.id} value={i.id} className="gap-1.5">
                <i.icon className="h-3.5 w-3.5" /> {i.label}
              </TabsTrigger>
            ))}
            <span className="px-2 text-xs text-muted-foreground self-center">·</span>
            {INDICATORS.filter((i) => i.group === "operacao").map((i) => (
              <TabsTrigger key={i.id} value={i.id} className="gap-1.5">
                <i.icon className="h-3.5 w-3.5" /> {i.label}
              </TabsTrigger>
            ))}
            <span className="px-2 text-xs text-muted-foreground self-center">·</span>
            {INDICATORS.filter((i) => i.group === "budgets").map((i) => (
              <TabsTrigger key={i.id} value={i.id} className="gap-1.5">
                <i.icon className="h-3.5 w-3.5" /> {i.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="geral" className="mt-4">
          {/* Matrix */}
          <div className="glass-card overflow-hidden">
            <div className="border-b border-border/40 px-4 py-3">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide">
                Matriz Loja × Cargo
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Clique numa célula para ver os indicadores</p>
            </div>
            <ScrollArea className="w-full">
              <div className="min-w-fit">
                <table className="w-full text-xs md:text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="sticky left-0 z-10 bg-muted/60 backdrop-blur px-3 py-2 text-left font-semibold border-r border-border/40 min-w-[180px]">
                        Loja
                      </th>
                      {cargos.map((c) => (
                        <th
                          key={c}
                          className={`px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[100px] ${hoverCol === c ? "bg-primary/10" : ""}`}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lojas.map((l) => (
                      <tr
                        key={l.code}
                        className={`border-t border-border/30 ${hoverRow === l.code ? "bg-primary/5" : ""}`}
                      >
                        <td className="sticky left-0 z-10 bg-background/90 backdrop-blur px-3 py-2 font-medium border-r border-border/40 whitespace-nowrap">
                          {l.nome}
                        </td>
                        {cargos.map((c) => {
                          const cell = matrix.get(`${l.code}|${c}`);
                          const exists = !!cell;
                          const v = cell?.payout_total_brl;
                          let bg = "bg-muted/20 text-muted-foreground";
                          if (exists && v != null) {
                            bg = v > 0
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                              : "bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 cursor-pointer";
                          }
                          return (
                            <td
                              key={c}
                              className={`px-2 py-2 text-center transition-colors ${bg}`}
                              onMouseEnter={() => { setHoverRow(l.code); setHoverCol(c); }}
                              onMouseLeave={() => { setHoverRow(null); setHoverCol(null); }}
                              onClick={() => exists && v != null && setDrill({ lojaCode: l.code, lojaNome: l.nome, cargo: c })}
                            >
                              {exists ? (v == null ? "—" : BRL(v)) : <span className="opacity-40">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {lojas.length === 0 && (
                      <tr>
                        <td colSpan={cargos.length + 1} className="p-8 text-center text-muted-foreground">
                          Nenhuma loja disponível.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {INDICATORS.map((ind) => (
          <TabsContent key={ind.id} value={ind.id} className="mt-4">
            <IndicatorRankingTab
              indicator={ind.id}
              direction={ind.direction}
              description={ind.description}
              brandFilter={ind.brandFilter}
              registry={data?.registry ?? []}
              rules={data?.rules ?? []}
              consolidated={data?.consolidated ?? []}
              allLojas={allLojas}
              isAdmin={isAdmin}
              isGerenteUnidade={isGerenteUnidade}
              userLojaCode={userLojaCode}
              accessibleLojaCodes={allowedCodes}
              mesRef={data?.mes_ref ?? null}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Drill-down */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className={isMobile ? "h-[100dvh] max-w-full rounded-none p-0" : "max-w-2xl"}>
          <DialogHeader className="p-4 border-b border-border/40">
            <DialogTitle className="font-display uppercase">
              {drill?.lojaNome} · {drill?.cargo} · {data?.mes_ref}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className={isMobile ? "h-[calc(100dvh-160px)]" : "max-h-[60vh]"}>
            <div className="p-4 space-y-2">
              {drillItems.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum indicador registrado.
                </p>
              )}
              {drillItems.map((r, i) => {
                const bp = breakpointVariant(r.breakpoint_desc);
                return (
                  <div key={i} className="rounded-lg border border-border/40 bg-card/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-sm">{r.indicador}</div>
                      <Badge variant="outline" className={`${bp.cls} font-medium`}>
                        {r.breakpoint_desc ?? bp.label}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Atingido:{" "}
                        <span className="text-foreground font-medium">
                          {r.resultado != null ? r.resultado.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}
                        </span>
                      </span>
                      <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                        {BRL(r.payout_brl)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="border-t border-border/40 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Total:</span>{" "}
              <span className="font-bold text-lg">{BRL(drillTotal)}</span>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={SHEET_URL} target="_blank" rel="noreferrer" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver na planilha
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
  );
}

function KpiCard({
  label, value, hint, accent,
}: { label: string; value: string; hint?: string; accent: "emerald" | "blue" | "red" | "amber" }) {
  const accentMap = {
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    blue: "from-blue-500/15 to-blue-500/5 text-blue-700 dark:text-blue-300",
    red: "from-red-500/15 to-red-500/5 text-red-700 dark:text-red-300",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300",
  } as const;
  return (
    <div className={`glass-card bg-gradient-to-br ${accentMap[accent]} p-3 md:p-4`}>
      <div className="text-[10px] md:text-xs uppercase tracking-wider opacity-80 font-semibold">{label}</div>
      <div className="mt-1 text-xl md:text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] opacity-70">{hint}</div>}
    </div>
  );
}
