import { useMemo } from "react";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSalmonDaily } from "@/hooks/useSalmonDaily";
import { VisionKpiCard } from "@/components/painel/VisionKpiCard";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, TrendingDown, TrendingUp, Fish } from "lucide-react";

const SEMAPHORE_COLOR: Record<string, string> = {
  green: "bg-emerald-500 text-white",
  yellow: "bg-amber-500 text-white",
  red: "bg-red-500 text-white",
  gray: "bg-slate-400 text-white",
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

export function SalmaoEficienciaDashboard() {
  const { effectiveUnidadeId } = useUnidade();
  const { isAdmin, isOperator } = useUserProfile();
  const podeVerFinanceiro = isAdmin || isOperator;

  const { data, summary, isLoading } = useSalmonDaily(effectiveUnidadeId);

  const kpis = useMemo(() => {
    if (!summary) return null;
    return {
      avg: summary.ratio_avg ?? 0,
      green: summary.dias_verde,
      yellow: summary.dias_amarelo,
      red: summary.dias_vermelho,
      best: summary.ratio_best ?? 0,
      worst: summary.ratio_worst ?? 0,
    };
  }, [summary]);

  if (!effectiveUnidadeId) {
    return (
      <div className="text-sm text-muted-foreground p-6">
        Selecione uma unidade para visualizar a eficiência do salmão.
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Carregando salmão…</div>;
  }

  if (!data?.length) {
    return (
      <div className="text-sm text-muted-foreground p-6">
        Sem dados de salmão no período.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <VisionKpiCard
          title="Ratio médio (mês)"
          icon={Activity}
          value={kpis?.avg ?? null}
          loading={false}
          suffix="kg/R$1k"
        />
        <VisionKpiCard
          title="Dias verdes"
          icon={TrendingUp}
          value={kpis?.green ?? null}
          loading={false}
          integer
          accent="hsl(142 71% 45%)"
        />
        <VisionKpiCard
          title="Dias amarelos / vermelhos"
          icon={TrendingDown}
          value={(kpis?.yellow ?? 0) + (kpis?.red ?? 0)}
          loading={false}
          integer
          accent="hsl(0 84% 60%)"
          helper={`${kpis?.yellow ?? 0} amarelos · ${kpis?.red ?? 0} vermelhos`}
        />
        <VisionKpiCard
          title="Melhor / pior ratio"
          icon={Fish}
          value={kpis?.best ?? null}
          loading={false}
          helper={`Pior: ${(kpis?.worst ?? 0).toFixed(3)}`}
        />
      </div>

      {/* Gráfico de linha 30 dias */}
      <div className="vision-glass p-4 sm:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Ratio diário · últimos 30 dias
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="transaction_date"
                tickFormatter={fmtDate}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                labelFormatter={(v) => fmtDate(String(v))}
                formatter={(v: number) => [v.toFixed(3), "Ratio"]}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <ReferenceLine y={1.55} stroke="hsl(142 71% 45%)" strokeDasharray="4 4" />
              <ReferenceLine y={1.65} stroke="hsl(0 84% 60%)" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="ratio_kg_per_1k"
                stroke="hsl(14 80% 55%)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela drill-down */}
      <div className="vision-glass p-4 sm:p-6 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Inicial</TableHead>
              <TableHead className="text-right">Transferência</TableHead>
              <TableHead className="text-right">Final</TableHead>
              <TableHead className="text-right">Consumo</TableHead>
              {podeVerFinanceiro && <TableHead className="text-right">Faturamento</TableHead>}
              <TableHead className="text-right">Ratio</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data].reverse().map((row) => (
              <TableRow key={row.id}>
                <TableCell>{fmtDate(row.transaction_date)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.initial_stock_kg.toFixed(2)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.transfer_kg.toFixed(2)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.final_stock_kg.toFixed(2)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.consumption_kg.toFixed(2)}
                </TableCell>
                {podeVerFinanceiro && (
                  <TableCell className="text-right tabular-nums">
                    {row.revenue_brl != null ? fmtBRL(row.revenue_brl) : "—"}
                  </TableCell>
                )}
                <TableCell className="text-right tabular-nums font-semibold">
                  {row.ratio_kg_per_1k.toFixed(3)}
                </TableCell>
                <TableCell>
                  <Badge className={SEMAPHORE_COLOR[row.semaphore] ?? SEMAPHORE_COLOR.gray}>
                    {row.semaphore}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
