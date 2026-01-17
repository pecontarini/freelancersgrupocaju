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
import { formatCurrency, parseDateString } from "@/lib/formatters";
import { TrendingUp, TrendingDown } from "lucide-react";

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
  // Calculate total for percentages
  const totalValue = useMemo(() => {
    return entries.reduce((acc, entry) => acc + entry.valor, 0);
  }, [entries]);

  // Data by Função with percentage
  const dataByFuncao = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      const key = entry.funcao || "Sem Função";
      acc[key] = (acc[key] || 0) + entry.valor;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.value - a.value);
  }, [entries, totalValue]);

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
      const date = parseDateString(entry.data_pop);
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

  const PieTooltipWithPercent = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg min-w-[160px]">
          <p className="font-semibold text-foreground mb-1">{data.name}</p>
          <p className="text-sm text-primary font-medium">
            {formatCurrency(data.value)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.percentage}% do total
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

  // Top 5 functions for ranking
  const topFuncoes = dataByFuncao.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Distribution by Função - Donut Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Distribuição de Custos por Função
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Total do período: {formatCurrency(totalValue)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Donut Chart */}
              <div className="h-[280px] sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataByFuncao}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={false}
                    >
                      {dataByFuncao.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltipWithPercent />} />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: 16 }}
                      formatter={(value, entry: any) => (
                        <span className="text-xs sm:text-sm text-foreground">
                          {value} ({entry.payload.percentage}%)
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Ranking Cards */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground mb-3">
                  Ranking de Custos por Função
                </h4>
                {topFuncoes.map((funcao, index) => (
                  <div
                    key={funcao.name}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    >
                      {index + 1}º
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {funcao.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(funcao.value)} • {funcao.percentage}%
                      </p>
                    </div>
                    {index === 0 && (
                      <TrendingUp className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                  </div>
                ))}
                {topFuncoes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum dado disponível
                  </p>
                )}
              </div>
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
        <Card>
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
    </div>
  );
};