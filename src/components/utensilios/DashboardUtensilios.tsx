import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUtensiliosCatalog, useUtensiliosItems, useDistinctSemanas, useUtensiliosContagens } from "@/hooks/useUtensilios";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SectorFilter } from "./SectorFilter";
import { AlertTriangle, TrendingDown, DollarSign, Package, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const SECTOR_COLORS: Record<string, string> = {
  Cozinha: "#ef4444",
  Bar: "#f59e0b",
  Salão: "#3b82f6",
  Parrilla: "#8b5cf6",
  Sushi: "#10b981",
};

export function DashboardUtensilios() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: catalog } = useUtensiliosCatalog();
  const { data: storeItems, isLoading } = useUtensiliosItems(effectiveUnidadeId);
  const { data: semanas } = useDistinctSemanas(effectiveUnidadeId);
  const isMobile = useIsMobile();

  const [semanaRef, setSemanaRef] = useState<string>("");
  const [setor, setSetor] = useState("Todos");
  const { data: contagens } = useUtensiliosContagens(effectiveUnidadeId, semanaRef || null);

  // Build lookup maps
  const storeMap = useMemo(() => {
    const map: Record<string, any> = {};
    storeItems?.forEach((si: any) => { map[si.id] = si; });
    return map;
  }, [storeItems]);

  const catalogMap = useMemo(() => {
    const map: Record<string, any> = {};
    catalog?.forEach((c: any) => { map[c.id] = c; });
    return map;
  }, [catalog]);

  // Build analytics from contagens
  const analytics = useMemo(() => {
    if (!storeItems || !contagens) return null;

    // Get last count per item (FECHAMENTO preferred)
    const lastCounts: Record<string, number> = {};
    contagens.forEach((c: any) => {
      if (c.turno === "FECHAMENTO") lastCounts[c.utensilio_item_id] = c.quantidade_contada;
    });
    // Fill with ABERTURA if no FECHAMENTO
    contagens.forEach((c: any) => {
      if (c.turno === "ABERTURA" && !(c.utensilio_item_id in lastCounts)) {
        lastCounts[c.utensilio_item_id] = c.quantidade_contada;
      }
    });

    // Variance: ABERTURA vs FECHAMENTO
    const aberturaMap: Record<string, number> = {};
    const fechamentoMap: Record<string, number> = {};
    contagens.forEach((c: any) => {
      if (c.turno === "ABERTURA") aberturaMap[c.utensilio_item_id] = c.quantidade_contada;
      if (c.turno === "FECHAMENTO") fechamentoMap[c.utensilio_item_id] = c.quantidade_contada;
    });

    const items = storeItems
      .filter((si: any) => setor === "Todos" || si.area_responsavel === setor)
      .map((si: any) => {
        const count = lastCounts[si.id] ?? 0;
        const min = si.estoque_minimo || 0;
        const deficit = Math.max(0, min - count);
        const unitCost = si.valor_unitario || catalogMap[si.catalog_item_id]?.preco_custo || 0;
        const deficitCost = deficit * unitCost;
        const abertura = aberturaMap[si.id];
        const fechamento = fechamentoMap[si.id];
        const variacao = abertura != null && fechamento != null ? fechamento - abertura : null;

        return {
          id: si.id,
          name: catalogMap[si.catalog_item_id]?.name || "—",
          setor: si.area_responsavel || "Salão",
          min,
          count,
          deficit,
          unitCost,
          deficitCost,
          variacao,
          absVariacao: variacao != null ? Math.abs(variacao) : 0,
        };
      });

    const belowMin = items.filter((i) => i.deficit > 0);
    const totalDeficitValue = belowMin.reduce((s, i) => s + i.deficitCost, 0);
    const topVariance = [...items].filter(i => i.variacao != null).sort((a, b) => b.absVariacao - a.absVariacao).slice(0, 10);
    const topExpensive = [...belowMin].sort((a, b) => b.deficitCost - a.deficitCost).slice(0, 10);

    // Deficit by sector
    const sectorDeficit: Record<string, number> = {};
    items.forEach((i) => {
      sectorDeficit[i.setor] = (sectorDeficit[i.setor] || 0) + i.deficitCost;
    });
    const chartData = Object.entries(sectorDeficit)
      .filter(([, v]) => v > 0)
      .map(([setor, valor]) => ({ setor, valor }))
      .sort((a, b) => b.valor - a.valor);

    return {
      totalConfigured: items.length,
      belowMinCount: belowMin.length,
      totalDeficitValue,
      topVariance,
      topExpensive,
      chartData,
    };
  }, [storeItems, contagens, catalogMap, setor]);

  if (!effectiveUnidadeId) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  }
  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className={isMobile ? "space-y-3" : "flex flex-wrap gap-3 items-end"}>
        <div className={isMobile ? "w-full" : "flex-1 min-w-[200px]"}>
          <Label>Semana de Referência</Label>
          <Select value={semanaRef} onValueChange={setSemanaRef}>
            <SelectTrigger><SelectValue placeholder="Selecionar semana" /></SelectTrigger>
            <SelectContent>{semanas?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <SectorFilter value={setor} onChange={setSetor} className={isMobile ? "w-full" : "min-w-[160px]"} />
      </div>

      {!semanaRef ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma semana para ver o dashboard.</CardContent></Card>
      ) : !analytics ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Sem dados.</CardContent></Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <Package className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-[10px] text-muted-foreground">Configurados</p>
                <p className="text-lg font-bold">{analytics.totalConfigured}</p>
              </CardContent>
            </Card>
            <Card className={analytics.belowMinCount > 0 ? "border-destructive/50" : ""}>
              <CardContent className="p-3 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                <p className="text-[10px] text-muted-foreground">Abaixo do Mínimo</p>
                <p className="text-lg font-bold text-destructive">{analytics.belowMinCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-destructive" />
                <p className="text-[10px] text-muted-foreground">Valor do Déficit</p>
                <p className="text-lg font-bold">R$ {analytics.totalDeficitValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <TrendingDown className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                <p className="text-[10px] text-muted-foreground">Maior Variação</p>
                <p className="text-lg font-bold">{analytics.topVariance[0]?.absVariacao ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart: Deficit by Sector */}
          {analytics.chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Déficit por Setor (R$)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.chartData}>
                    <XAxis dataKey="setor" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                      {analytics.chartData.map((entry, i) => (
                        <Cell key={i} fill={SECTOR_COLORS[entry.setor] || "#6b7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Rankings */}
          <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-4"}>
            {/* Top Variance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">🔄 Maior Variação (Abertura → Fechamento)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {analytics.topVariance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem variações nesta semana.</p>
                ) : analytics.topVariance.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.setor}</p>
                    </div>
                    <Badge variant={item.variacao! < 0 ? "destructive" : "outline"} className="text-xs">
                      {item.variacao! > 0 ? `+${item.variacao}` : item.variacao}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top Expensive Deficit */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">💰 Maior Custo de Reposição</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {analytics.topExpensive.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item com déficit.</p>
                ) : analytics.topExpensive.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.setor} · Déficit: {item.deficit} un</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-destructive">
                      R$ {item.deficitCost.toFixed(2)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
