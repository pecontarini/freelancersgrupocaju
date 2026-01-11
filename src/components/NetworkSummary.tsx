import { useMemo } from "react";
import { Building2, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FreelancerEntry } from "@/types/freelancer";
import { formatCurrency } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface NetworkSummaryProps {
  entries: FreelancerEntry[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function NetworkSummary({ entries }: NetworkSummaryProps) {
  const summaryData = useMemo(() => {
    // Group by loja
    const byLoja = entries.reduce((acc, entry) => {
      const loja = entry.loja;
      if (!acc[loja]) {
        acc[loja] = {
          name: loja,
          total: 0,
          count: 0,
          freelancers: new Set<string>(),
        };
      }
      acc[loja].total += entry.valor;
      acc[loja].count += 1;
      acc[loja].freelancers.add(entry.cpf);
      return acc;
    }, {} as Record<string, { name: string; total: number; count: number; freelancers: Set<string> }>);

    const lojaData = Object.values(byLoja)
      .map((loja) => ({
        name: loja.name,
        total: loja.total,
        count: loja.count,
        freelancers: loja.freelancers.size,
      }))
      .sort((a, b) => b.total - a.total);

    const totalNetwork = entries.reduce((sum, e) => sum + e.valor, 0);
    const totalEntries = entries.length;
    const uniqueFreelancers = new Set(entries.map((e) => e.cpf)).size;

    return {
      lojaData,
      totalNetwork,
      totalEntries,
      uniqueFreelancers,
      topLoja: lojaData[0] || null,
      lowestLoja: lojaData[lojaData.length - 1] || null,
    };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <p className="text-muted-foreground">Nenhum dado disponível para exibir.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Network Totals */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total da Rede
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(summaryData.totalNetwork)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summaryData.totalEntries}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Freelancers Únicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summaryData.uniqueFreelancers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unidades Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summaryData.lojaData.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top and Lowest */}
      <div className="grid gap-4 md:grid-cols-2">
        {summaryData.topLoja && (
          <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <TrendingUp className="h-4 w-4" />
                Maior Custo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{summaryData.topLoja.name}</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {formatCurrency(summaryData.topLoja.total)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summaryData.topLoja.count} lançamentos • {summaryData.topLoja.freelancers} freelancers
              </p>
            </CardContent>
          </Card>
        )}

        {summaryData.lowestLoja && summaryData.lojaData.length > 1 && (
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                <TrendingDown className="h-4 w-4" />
                Menor Custo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{summaryData.lowestLoja.name}</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {formatCurrency(summaryData.lowestLoja.total)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summaryData.lowestLoja.count} lançamentos • {summaryData.lowestLoja.freelancers} freelancers
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Comparative Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Comparativo por Unidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaryData.lojaData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    new Intl.NumberFormat("pt-BR", {
                      notation: "compact",
                      compactDisplay: "short",
                      currency: "BRL",
                    }).format(value)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Total"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {summaryData.lojaData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
