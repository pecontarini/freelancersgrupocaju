import { useMemo } from "react";
import { 
  Rocket, 
  AlertTriangle, 
  CheckCircle2, 
  Trophy,
  TrendingUp,
  TrendingDown,
  Clock,
  Bell
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useStorePerformance, type BonusTier } from "@/hooks/useBonusRules";
import { useSupervisionAudits } from "@/hooks/useSupervisionAudits";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { formatCurrency } from "@/lib/formatters";

interface FeedEvent {
  id: string;
  type: "win" | "alert" | "info";
  icon: React.ElementType;
  title: string;
  description: string;
  timestamp: Date;
  storeName?: string;
  metadata?: Record<string, unknown>;
}

interface WinsAlertsFeedProps {
  lojaId?: string | null;
  showAllStores?: boolean;
}

export function WinsAlertsFeed({ lojaId, showAllStores = false }: WinsAlertsFeedProps) {
  const { performances } = useStorePerformance();
  const { audits, failures } = useSupervisionAudits(showAllStores ? undefined : lojaId);
  const { options: lojas } = useConfigLojas();

  const getStoreName = (storeId: string) => {
    return lojas.find(l => l.id === storeId)?.nome || "Unidade";
  };

  // Generate feed events based on real data
  const feedEvents = useMemo((): FeedEvent[] => {
    const events: FeedEvent[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Check store performances for wins/alerts
    performances.forEach(perf => {
      if (!showAllStores && perf.loja_id !== lojaId) return;

      const perfDate = new Date(perf.updated_at);
      if (perfDate < thirtyDaysAgo) return;

      const storeName = getStoreName(perf.loja_id);
      const npsEfficiency = perf.num_reclamacoes > 0 
        ? perf.faturamento / perf.num_reclamacoes 
        : perf.faturamento;

      // Gold tier achievement (>= 200k efficiency)
      if (npsEfficiency >= 200000) {
        events.push({
          id: `gold-${perf.id}`,
          type: "win",
          icon: Rocket,
          title: `${storeName} atingiu ritmo NÍVEL OURO!`,
          description: `Eficiência NPS de ${formatCurrency(npsEfficiency)} - Parabéns ao time!`,
          timestamp: perfDate,
          storeName,
          metadata: { tier: "ouro" as BonusTier, efficiency: npsEfficiency },
        });
      }

      // Red flag alert (supervision < 80% or NPS below bronze)
      if (perf.supervisao_score < 80) {
        events.push({
          id: `redflag-sup-${perf.id}`,
          type: "alert",
          icon: AlertTriangle,
          title: `Alerta: ${storeName} em tendência RED FLAG`,
          description: `Supervisão em ${perf.supervisao_score.toFixed(0)}% - Meta mínima: 80%`,
          timestamp: perfDate,
          storeName,
          metadata: { score: perf.supervisao_score },
        });
      }

      // High revenue achievement
      if (perf.faturamento >= 300000) {
        events.push({
          id: `revenue-${perf.id}`,
          type: "win",
          icon: TrendingUp,
          title: `${storeName} superou R$ 300k em faturamento`,
          description: `Faturamento atual: ${formatCurrency(perf.faturamento)}`,
          timestamp: perfDate,
          storeName,
          metadata: { faturamento: perf.faturamento },
        });
      }
    });

    // Check audit completions
    audits.forEach(audit => {
      const auditDate = new Date(audit.processed_at);
      if (auditDate < thirtyDaysAgo) return;

      const storeName = getStoreName(audit.loja_id);

      if (audit.global_score >= 95) {
        events.push({
          id: `audit-excellent-${audit.id}`,
          type: "win",
          icon: Trophy,
          title: `${storeName} obteve ${audit.global_score.toFixed(0)}% na auditoria`,
          description: "Excelência operacional confirmada!",
          timestamp: auditDate,
          storeName,
          metadata: { score: audit.global_score },
        });
      } else if (audit.global_score < 80) {
        events.push({
          id: `audit-low-${audit.id}`,
          type: "alert",
          icon: AlertTriangle,
          title: `Auditoria de ${storeName}: ${audit.global_score.toFixed(0)}%`,
          description: "Score abaixo do mínimo aceitável. Plano de ação necessário.",
          timestamp: auditDate,
          storeName,
          metadata: { score: audit.global_score },
        });
      }
    });

    // Check for 100% failures resolved
    const failuresByStore = failures.reduce((acc, f) => {
      if (!acc[f.loja_id]) acc[f.loja_id] = { total: 0, resolved: 0 };
      acc[f.loja_id].total++;
      if (f.status === "validated") acc[f.loja_id].resolved++;
      return acc;
    }, {} as Record<string, { total: number; resolved: number }>);

    Object.entries(failuresByStore).forEach(([storeId, data]) => {
      if (!showAllStores && storeId !== lojaId) return;
      
      if (data.total > 0 && data.resolved === data.total) {
        const storeName = getStoreName(storeId);
        events.push({
          id: `all-resolved-${storeId}`,
          type: "win",
          icon: CheckCircle2,
          title: `${storeName} corrigiu 100% das não conformidades`,
          description: `${data.total} item(s) resolvido(s) e validado(s)`,
          timestamp: new Date(),
          storeName,
          metadata: { total: data.total },
        });
      }
    });

    // Sort by timestamp (newest first)
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [performances, audits, failures, lojaId, showAllStores, lojas]);

  const getEventStyle = (type: FeedEvent["type"]) => {
    switch (type) {
      case "win":
        return {
          bg: "bg-emerald-500/10",
          border: "border-l-emerald-500",
          iconBg: "bg-emerald-500/20",
          iconColor: "text-emerald-500",
        };
      case "alert":
        return {
          bg: "bg-amber-500/10",
          border: "border-l-amber-500",
          iconBg: "bg-amber-500/20",
          iconColor: "text-amber-500",
        };
      default:
        return {
          bg: "bg-muted/50",
          border: "border-l-muted-foreground",
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        };
    }
  };

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base uppercase">
          <Bell className="h-5 w-5 text-primary" />
          Vitórias e Alertas
          {feedEvents.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {feedEvents.length} evento{feedEvents.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {feedEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground px-6">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum evento recente</p>
            <p className="text-sm">Os eventos aparecem conforme a performance é atualizada</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-1 p-4">
              {feedEvents.map((event) => {
                const style = getEventStyle(event.type);
                const Icon = event.icon;

                return (
                  <div
                    key={event.id}
                    className={`flex gap-4 p-4 rounded-xl border-l-4 transition-all duration-300 hover:scale-[1.02] ${style.bg} ${style.border}`}
                  >
                    <div className={`shrink-0 p-2 rounded-lg ${style.iconBg}`}>
                      <Icon className={`h-5 w-5 ${style.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{event.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {formatDistanceToNow(event.timestamp, { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </Badge>
                        {event.type === "win" && (
                          <span className="text-xs">🎉</span>
                        )}
                        {event.type === "alert" && (
                          <span className="text-xs">⚠️</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
