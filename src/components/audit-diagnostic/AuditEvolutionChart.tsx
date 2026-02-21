import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SupervisionAudit } from "@/hooks/useSupervisionAudits";

interface EvolutionDataPoint {
  date: string;
  dateLabel: string;
  score: number;
  auditId: string;
}

interface AuditEvolutionChartProps {
  audits: SupervisionAudit[];
  onAuditClick?: (auditId: string) => void;
}

export function AuditEvolutionChart({ audits, onAuditClick }: AuditEvolutionChartProps) {
  const data: EvolutionDataPoint[] = audits
    .slice()
    .sort((a, b) => a.audit_date.localeCompare(b.audit_date))
    .map((a) => ({
      date: a.audit_date,
      dateLabel: new Date(a.audit_date + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      score: Math.round(a.global_score * 10) / 10,
      auditId: a.id,
    }));

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm uppercase">
          <TrendingUp className="h-4 w-4 text-primary" />
          Evolução da Nota (Dia a Dia)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Nenhuma auditoria no período selecionado.
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as EvolutionDataPoint;
                      return (
                        <div className="bg-popover border rounded-lg p-3 shadow-lg">
                          <p className="text-xs text-muted-foreground">{d.date}</p>
                          <p className="text-primary font-bold text-lg">{d.score}%</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Clique para ver detalhes
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={90} stroke="hsl(142, 71%, 45%)" strokeDasharray="3 3" />
                <ReferenceLine y={80} stroke="hsl(45, 93%, 47%)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "hsl(var(--primary))", cursor: "pointer" }}
                  activeDot={{
                    r: 7,
                    fill: "hsl(var(--primary))",
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                    cursor: "pointer",
                    onClick: (_: any, payload: any) => {
                      if (onAuditClick && payload?.payload?.auditId) {
                        onAuditClick(payload.payload.auditId);
                      }
                    },
                  }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
