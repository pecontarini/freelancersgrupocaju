import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown } from "lucide-react";
import { DIAS, type CamaraEntry, type PracaEntry, type SemanaCMV } from "@/hooks/useCMVSemanas";
import {
  useVendasAjuste,
  useWeeklySales,
  useSalesMappings,
  useDesvioCalculation,
} from "@/hooks/useCMVVendasDesvio";

type CMVItem = { id: string; nome: string; unidade: string };

interface Props {
  semana: SemanaCMV;
  items: CMVItem[];
  camaraEntries: CamaraEntry[];
  pracaEntries: PracaEntry[];
}

const META = 0.6;

export function CMVDesvioResumo({ semana, items, camaraEntries, pracaEntries }: Props) {
  const { entries: ajusteEntries } = useVendasAjuste(semana.id);
  const { data: salesData = [] } = useWeeklySales(semana.data_inicio, semana.data_fim);
  const { data: mappings = [] } = useSalesMappings();

  const { desvioRows } = useDesvioCalculation(
    semana, items, camaraEntries, pracaEntries, ajusteEntries, salesData, mappings
  );

  // Classic câmara stats (saídas vs base)
  const camaraStats = useMemo(() => {
    let totalSaidas = 0;
    let totalBase = 0;
    const perItem: { nome: string; desvio: number }[] = [];

    items.forEach((item) => {
      const saldoInicial = (semana.saldo_anterior_json as Record<string, number>)?.[item.id] ?? 0;
      let itemEntradas = 0;
      let itemSaidas = 0;
      DIAS.forEach((dia) => {
        const e = camaraEntries.find((c) => c.cmv_item_id === item.id && c.dia === dia);
        itemEntradas += e?.entrada ?? 0;
        itemSaidas += e?.saida ?? 0;
      });
      const base = saldoInicial + itemEntradas;
      totalSaidas += itemSaidas;
      totalBase += base;
      if (base > 0) perItem.push({ nome: item.nome, desvio: (itemSaidas / base) * 100 });
    });

    const globalDesvio = totalBase > 0 ? (totalSaidas / totalBase) * 100 : 0;
    const topDesvios = perItem.sort((a, b) => b.desvio - a.desvio).slice(0, 3);
    return { globalDesvio, topDesvios };
  }, [items, camaraEntries, semana.saldo_anterior_json]);

  // Classic praça stats
  const pracaStats = useMemo(() => {
    let totalVar = 0;
    let totalT1 = 0;
    const perItem: { nome: string; desvio: number }[] = [];

    items.forEach((item) => {
      let itemT1 = 0;
      let itemVar = 0;
      DIAS.forEach((dia) => {
        const e = pracaEntries.find((p) => p.cmv_item_id === item.id && p.dia === dia);
        const t1 = e?.t1_abertura ?? 0;
        const t3 = e?.t3_fechamento ?? 0;
        if (e?.t1_abertura != null && e?.t3_fechamento != null) {
          itemT1 += t1;
          itemVar += t1 - t3;
        }
      });
      totalT1 += itemT1;
      totalVar += itemVar;
      if (itemT1 > 0) perItem.push({ nome: item.nome, desvio: (itemVar / itemT1) * 100 });
    });

    const globalDesvio = totalT1 > 0 ? (totalVar / totalT1) * 100 : 0;
    const topDesvios = perItem.sort((a, b) => b.desvio - a.desvio).slice(0, 3);
    return { globalDesvio, topDesvios };
  }, [items, pracaEntries]);

  // Vendas vs real stats
  const vendasStats = useMemo(() => {
    const withData = desvioRows.filter((r) => r.vendasTotal > 0);
    if (!withData.length) return null;

    const totalConsumo = withData.reduce((s, r) => s + r.consumoCamara, 0);
    const totalVendas = withData.reduce((s, r) => s + r.vendasTotal, 0);
    const desvioGlobal = totalVendas > 0 ? ((totalConsumo - totalVendas) / totalVendas) * 100 : 0;

    const topDesvios = [...withData]
      .sort((a, b) => Math.abs(b.desvioCamaraPct) - Math.abs(a.desvioCamaraPct))
      .slice(0, 3)
      .map((r) => ({ nome: r.itemNome, desvio: r.desvioCamaraPct }));

    return { globalDesvio: desvioGlobal, topDesvios };
  }, [desvioRows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          Resumo de Desvio Semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Câmara */}
          <DesvioBlock label="Câmara" stats={camaraStats} />
          {/* Praça */}
          <DesvioBlock label="Praça" stats={pracaStats} />
          {/* Vendas vs Real */}
          {vendasStats && <DesvioBlock label="Real vs Vendas" stats={vendasStats} />}
        </div>
      </CardContent>
    </Card>
  );
}

function DesvioBlock({ label, stats }: { label: string; stats: { globalDesvio: number; topDesvios: { nome: string; desvio: number }[] } }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={Math.abs(stats.globalDesvio) > META ? "destructive" : "default"}>
          {stats.globalDesvio.toFixed(2)}% {Math.abs(stats.globalDesvio) > META ? "🔴" : "🟢"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">Meta: ≤ {META}%</p>
      {stats.topDesvios.length > 0 && (
        <ul className="text-xs space-y-0.5">
          {stats.topDesvios.map((d) => (
            <li key={d.nome} className="flex justify-between">
              <span>• {d.nome}</span>
              <span className="font-medium">{d.desvio.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
