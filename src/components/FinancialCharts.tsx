import { useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FreelancerEntry } from "@/types/freelancer";
import { formatCurrency } from "@/lib/formatters";

interface FinancialChartsProps {
  entries: FreelancerEntry[];
}

const CHART_COLORS = [
  "hsl(12, 76%, 61%)",    // Coral/Terracotta
  "hsl(173, 58%, 39%)",   // Teal
  "hsl(43, 96%, 56%)",    // Amber
  "hsl(215, 72%, 52%)",   // Blue
  "hsl(330, 72%, 55%)",   // Pink
  "hsl(142, 71%, 45%)",   // Green
  "hsl(271, 76%, 53%)",   // Purple
  "hsl(24, 85%, 55%)",    // Orange
  "hsl(197, 71%, 52%)",   // Cyan
  "hsl(350, 65%, 52%)",   // Red
  "hsl(88, 55%, 50%)",    // Lime
  "hsl(262, 52%, 47%)",   // Indigo
];

export const FinancialCharts = ({ entries }: FinancialChartsProps) => {
  // Data by Setor
  const dataBySetor = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      const key = entry.setor || "Sem Setor";
      acc[key] = (acc[key] || 0) + entry.valor;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [entries]);

  // Data by Gerência
  const dataByGerencia = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      const key = entry.gerencia || "Sem Gerência";
      acc[key] = (acc[key] || 0) + entry.valor;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [entries]);

  // Data by Period (monthly)
  const dataByPeriod = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      const date = new Date(entry.data_pop);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      acc[monthKey] = (acc[monthKey] || 0) + entry.valor;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([period, value]) => {
        const [year, month] = period.split("-");
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return {
          name: `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`,
          value,
          sortKey: period,
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [entries]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-primary">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-primary">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        Nenhum dado disponível para exibir gráficos
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Costs by Setor - Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custos por Setor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataBySetor}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {dataBySetor.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-sm text-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Costs by Gerência - Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custos por Gerência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataByGerencia} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) =>
                    value.length > 12 ? `${value.slice(0, 12)}...` : value
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {dataByGerencia.map((_, index) => (
                    <Cell
                      key={`cell-gerencia-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Costs by Period - Line Chart */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Evolução de Custos por Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataByPeriod}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: "hsl(var(--accent))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
