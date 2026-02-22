import { useState, useEffect, useMemo } from "react";
import { BarChart3, Loader2, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { SECTOR_POSITION_MAP, type AuditSector } from "@/lib/sectorPositionMapping";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface ChecklistResponsesDashboardProps {
  lojaId: string;
}

interface ResponseRow {
  id: string;
  sector_code: string;
  response_date: string;
  total_score: number;
  total_items: number;
  conforming_items: number;
  responded_by_name: string | null;
  created_at: string;
}

const SECTOR_COLORS: Record<string, string> = {
  bar: "#8b5cf6",
  cozinha: "#f97316",
  cozinha_quente: "#ef4444",
  saladas_sobremesas: "#22c55e",
  parrilla: "#dc2626",
  sushi: "#3b82f6",
  salao: "#10b981",
  estoque: "#6366f1",
  area_comum: "#64748b",
  delivery: "#eab308",
  recepcao: "#ec4899",
  lavagem: "#06b6d4",
  dml: "#a855f7",
  asg: "#84cc16",
  manutencao: "#f59e0b",
  brinquedoteca: "#14b8a6",
  documentos: "#78716c",
};

export function ChecklistResponsesDashboard({ lojaId }: ChecklistResponsesDashboardProps) {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const [responseItems, setResponseItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (lojaId) fetchResponses();
  }, [lojaId]);

  async function fetchResponses() {
    setLoading(true);
    const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const { data } = await supabase
      .from("checklist_responses")
      .select("*")
      .eq("loja_id", lojaId)
      .gte("response_date", from)
      .order("response_date", { ascending: false });

    setResponses((data as ResponseRow[]) || []);
    setLoading(false);
  }

  async function toggleDrillDown(responseId: string) {
    if (expandedResponse === responseId) {
      setExpandedResponse(null);
      setResponseItems([]);
      return;
    }
    setExpandedResponse(responseId);
    setLoadingItems(true);
    const { data } = await supabase
      .from("checklist_response_items")
      .select("*, checklist_template_items(item_text, weight)")
      .eq("response_id", responseId);
    setResponseItems(data || []);
    setLoadingItems(false);
  }

  // Chart data: group by date + sector
  const chartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    responses.forEach((r) => {
      if (!byDate[r.response_date]) byDate[r.response_date] = {};
      byDate[r.response_date][r.sector_code] = r.total_score;
    });

    return Object.entries(byDate)
      .map(([date, sectors]) => ({ date: format(new Date(date), "dd/MM"), ...sectors }))
      .reverse();
  }, [responses]);

  const activeSectors = useMemo(() => {
    return [...new Set(responses.map((r) => r.sector_code))];
  }, [responses]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Evolution chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Evolução de Notas por Setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                {activeSectors.map((sector) => (
                  <Line
                    key={sector}
                    type="monotone"
                    dataKey={sector}
                    name={SECTOR_POSITION_MAP[sector as AuditSector]?.displayName || sector}
                    stroke={SECTOR_COLORS[sector] || "#8884d8"}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Responses list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Respostas Recentes (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma resposta registrada nos últimos 30 dias.
            </p>
          ) : (
            <div className="space-y-2">
              {responses.map((r) => {
                const sectorName = SECTOR_POSITION_MAP[r.sector_code as AuditSector]?.displayName || r.sector_code;
                const scoreColor = r.total_score >= 90 ? "text-green-600" : r.total_score >= 70 ? "text-yellow-600" : "text-red-600";
                const isExpanded = expandedResponse === r.id;

                return (
                  <div key={r.id}>
                    <button
                      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
                      onClick={() => toggleDrillDown(r.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{sectorName}</span>
                          <span className={`font-bold text-sm ${scoreColor}`}>
                            {r.total_score.toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(r.response_date), "dd/MM/yyyy", { locale: ptBR })} •{" "}
                          {r.responded_by_name || "Anônimo"} •{" "}
                          {r.conforming_items}/{r.total_items} conformes
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {isExpanded && (
                      <div className="ml-4 mt-1 border-l-2 pl-4 py-2 space-y-1">
                        {loadingItems ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          responseItems.map((item: any) => (
                            <div key={item.id} className="flex items-start gap-2 text-sm">
                              <Badge
                                variant={item.is_conforming ? "default" : "destructive"}
                                className="text-xs mt-0.5 shrink-0"
                              >
                                {item.is_conforming ? "OK" : "NC"}
                              </Badge>
                              <div>
                                <span>{item.checklist_template_items?.item_text || "Item"}</span>
                                {item.observation && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    💬 {item.observation}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
