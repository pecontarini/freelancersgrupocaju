import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip as RTooltip,
  CartesianGrid,
  Dot,
} from "recharts";
import { LineChart as LineIcon, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSheetsBlocks } from "@/hooks/useSheetsBlocks";
import { isMissingValue, toNumberOrNull, calculateMeanIgnoringMissing } from "@/lib/data-quality";

const FAIXA_VERDE = 1.55;
const FAIXA_AMARELO = 1.65;

function tierColor(v: number | null): string {
  if (v == null) return "hsl(var(--muted-foreground))";
  if (v <= FAIXA_VERDE) return "#10B981";
  if (v <= FAIXA_AMARELO) return "#F59E0B";
  return "#EF4444";
}
function tierLabel(v: number | null): string {
  if (v == null) return "—";
  if (v <= FAIXA_VERDE) return "Excelente";
  if (v <= FAIXA_AMARELO) return "Atenção";
  return "Acima do limite";
}

const fmt = (v: number | null | undefined, dec = 3) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: dec, minimumFractionDigits: dec });

interface DiaItem {
  data: string;
  loja_code: string;
  salmao_ratio: number;
}

export function SalmaoDiarioDrillContent({ lojaCode }: { lojaCode: string }) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<"chart" | "table">("chart");
  const { blocks, loading } = useSheetsBlocks("salmao_diario");

  const lojaItems = useMemo(() => {
    const items: DiaItem[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const b of blocks) {
      const arr = (b.payload?.items ?? []) as Array<Record<string, unknown>>;
      for (const it of arr) {
        const code = String(it.loja_code ?? "").replace(/\s+/g, "_").toUpperCase();
        const want = lojaCode.replace(/\s+/g, "_").toUpperCase();
        if (code !== want) continue;
        const data = String(it.data ?? "");
        if (!data) continue;
        // descarta dias futuros
        if (data > todayStr) continue;
        const ratio = toNumberOrNull(it.salmao_ratio);
        // descarta dias sem dado preenchido (#DIV/0!, vazio, etc.)
        if (ratio == null) continue;
        // descarta zero "vazio" — só vale se houver outro sinal de movimento
        if (ratio === 0) {
          const consumo = toNumberOrNull((it as any).consumo);
          const fat = toNumberOrNull((it as any).faturamento);
          if ((consumo == null || consumo === 0) && (fat == null || fat === 0)) continue;
        }
        items.push({ data, loja_code: code, salmao_ratio: ratio });
      }
    }
    return items.sort((a, b) => a.data.localeCompare(b.data));
  }, [blocks, lojaCode]);

  const isNazo = /^NZ[_\s]/.test(lojaCode.toUpperCase());

  const chartData = useMemo(
    () =>
      lojaItems.map((it) => {
        const [, m, d] = it.data.split("-");
        return { dia: `${d}/${m}`, valor: it.salmao_ratio, data: it.data };
      }),
    [lojaItems],
  );

  const stats = useMemo(() => {
    if (lojaItems.length === 0) return null;
    const valores = lojaItems.map((i) => i.salmao_ratio);
    const media = calculateMeanIgnoringMissing(valores);
    if (media == null) return null;
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    return { media, min, max, n: valores.length };
  }, [lojaItems]);

  if (!isNazo) return null;
  if (loading) {
    return <p className="text-xs text-muted-foreground py-2">Carregando salmão diário…</p>;
  }
  if (lojaItems.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Sem dados diários de salmão para esta loja.
      </p>
    );
  }

  const yMax = Math.max(3.5, ...chartData.map((d) => d.valor)) + 0.1;

  const Chart = (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.12} vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "var(--cj-text-muted)" }} />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 11, fill: "var(--cj-text-muted)" }}
            width={32}
          />
          <ReferenceLine
            y={FAIXA_VERDE}
            stroke="var(--cj-good)"
            strokeDasharray="3 3"
            opacity={0.4}
            label={{ value: "Excelente 1.55", fontSize: 9, fill: "var(--cj-good)", position: "right" }}
          />
          <ReferenceLine
            y={FAIXA_AMARELO}
            stroke="var(--cj-warn)"
            strokeDasharray="3 3"
            opacity={0.4}
            label={{ value: "Atenção 1.65", fontSize: 9, fill: "var(--cj-warn)", position: "right" }}
          />
          <RTooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => [`${fmt(v)} kg/R$1k · ${tierLabel(v)}`, "Salmão"]}
            labelFormatter={(l) => `Dia ${l}`}
          />
          <Line
            type="monotone"
            dataKey="valor"
            stroke="var(--cj-accent)"
            strokeWidth={2.5}
            dot={(props: any) => {
              const v = props.payload?.valor as number;
              return (
                <Dot
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={3}
                  fill={tierColor(v)}
                  stroke="var(--cj-bg-base)"
                  strokeWidth={1}
                />
              );
            }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const Table = (
    <ScrollArea className="max-h-[260px] w-full">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 sticky top-0">
          <tr>
            <th className="px-2 py-1.5 text-left">Data</th>
            <th className="px-2 py-1.5 text-right">kg/R$1k</th>
            <th className="px-2 py-1.5 text-right">Faixa</th>
          </tr>
        </thead>
        <tbody>
          {lojaItems.map((it) => {
            const c = tierColor(it.salmao_ratio);
            const [y, m, d] = it.data.split("-");
            return (
              <tr key={it.data} className="border-t border-border/30">
                <td className="px-2 py-1 tabular-nums">{`${d}/${m}/${y}`}</td>
                <td className="px-2 py-1 text-right tabular-nums font-semibold" style={{ color: c }}>
                  {fmt(it.salmao_ratio)}
                </td>
                <td className="px-2 py-1 text-right" style={{ color: c }}>
                  {tierLabel(it.salmao_ratio)}
                </td>
              </tr>
            );
          })}
        </tbody>
        {stats && (
          <tfoot className="bg-muted/30 sticky bottom-0">
            <tr className="border-t border-border/40">
              <td className="px-2 py-1.5 font-semibold">MÉDIA · {stats.n} dias</td>
              <td className="px-2 py-1.5 text-right font-bold tabular-nums" style={{ color: tierColor(stats.media) }}>
                {fmt(stats.media)}
              </td>
              <td className="px-2 py-1.5 text-right" style={{ color: tierColor(stats.media) }}>
                {tierLabel(stats.media)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </ScrollArea>
  );

  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Salmão diário · kg por R$1.000
          </div>
          {stats && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Média do período:{" "}
              <span className="font-semibold tabular-nums" style={{ color: tierColor(stats.media) }}>
                {fmt(stats.media)}
              </span>{" "}
              · min {fmt(stats.min)} · max {fmt(stats.max)}
            </div>
          )}
        </div>
        {isMobile && (
          <div className="flex gap-1">
            <Button
              variant={view === "chart" ? "default" : "outline"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setView("chart")}
            >
              <LineIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={view === "table" ? "default" : "outline"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setView("table")}
            >
              <TableIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {isMobile ? (
        view === "chart" ? Chart : Table
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Chart}
          {Table}
        </div>
      )}
    </div>
  );
}
