import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from "recharts";
import { TrendingUp, ShoppingBag, Truck, MessageSquare } from "lucide-react";

interface DiarioViewProps {
  selectedUnidadeId: string | null;
}

const RANGE_OPTS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function DiarioView({ selectedUnidadeId }: DiarioViewProps) {
  const [rangeDays, setRangeDays] = useState("30");

  const startDate = useMemo(
    () => format(subDays(new Date(), parseInt(rangeDays, 10)), "yyyy-MM-dd"),
    [rangeDays]
  );

  const { data: entries, isLoading } = useQuery({
    queryKey: ["store_performance_entries_daily", selectedUnidadeId, startDate],
    queryFn: async () => {
      let q = supabase
        .from("store_performance_entries")
        .select("entry_date, faturamento_salao, faturamento_delivery, reclamacoes_salao, reclamacoes_ifood, loja_id")
        .gte("entry_date", startDate)
        .order("entry_date", { ascending: true });

      if (selectedUnidadeId) {
        q = q.eq("loja_id", selectedUnidadeId);
      }

      const { data, error } = await q.range(0, 999);
      if (error) throw error;
      return data || [];
    },
  });

  const chartData = useMemo(() => {
    if (!entries) return [];
    // agregar por dia (somando todas as lojas se admin global)
    const byDate = new Map<string, any>();
    for (const row of entries) {
      const key = row.entry_date;
      const cur = byDate.get(key) || {
        date: key,
        salao: 0,
        delivery: 0,
        total: 0,
        recl_salao: 0,
        recl_ifood: 0,
        recl_total: 0,
      };
      cur.salao += Number(row.faturamento_salao || 0);
      cur.delivery += Number(row.faturamento_delivery || 0);
      cur.total = cur.salao + cur.delivery;
      cur.recl_salao += Number(row.reclamacoes_salao || 0);
      cur.recl_ifood += Number(row.reclamacoes_ifood || 0);
      cur.recl_total = cur.recl_salao + cur.recl_ifood;
      byDate.set(key, cur);
    }
    return Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        ...row,
        label: format(new Date(row.date + "T00:00:00"), "dd/MM", { locale: ptBR }),
      }));
  }, [entries]);

  const totals = useMemo(() => {
    const acc = chartData.reduce(
      (a, r) => ({
        salao: a.salao + r.salao,
        delivery: a.delivery + r.delivery,
        recl: a.recl + r.recl_total,
        days: a.days + 1,
      }),
      { salao: 0, delivery: 0, recl: 0, days: 0 }
    );
    return {
      ...acc,
      total: acc.salao + acc.delivery,
      ticket: acc.days > 0 ? (acc.salao + acc.delivery) / acc.days : 0,
    };
  }, [chartData]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Performance Diária
          </h3>
          <p className="text-sm text-muted-foreground">
            Evolução dos lançamentos diários alimentados pelo motor de importação
          </p>
        </div>
        <Select value={rangeDays} onValueChange={setRangeDays}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <ShoppingBag className="h-3 w-3" /> Salão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(totals.salao)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Truck className="h-3 w-3" /> Delivery
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(totals.delivery)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total no Período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatBRL(totals.total)}</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Média/dia: {formatBRL(totals.ticket)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <MessageSquare className="h-3 w-3" /> Reclamações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.recl}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faturamento Diário (Salão vs Delivery)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
              Sem dados no período. Use o motor de importação para alimentar os lançamentos diários.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <RTooltip
                  formatter={(v: any) => formatBRL(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="salao" name="Salão" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="delivery" name="Delivery" stroke="hsl(var(--chart-2, 200 80% 50%))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reclamações Diárias</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
              Sem dados no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                  }}
                />
                <Legend />
                <Bar dataKey="recl_salao" name="Salão" stackId="r" fill="hsl(var(--primary))" />
                <Bar dataKey="recl_ifood" name="iFood" stackId="r" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="text-center">
        <Badge variant="outline" className="text-[10px]">
          {chartData.length} dia(s) com dados • {entries?.length || 0} lançamento(s)
        </Badge>
      </div>
    </div>
  );
}
