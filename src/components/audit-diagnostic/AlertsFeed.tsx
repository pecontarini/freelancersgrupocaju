import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AlertsFeedProps {
  lojaId: string | null;
  isAdmin: boolean;
}

interface AuditAlert {
  id: string;
  loja_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

const severityConfig: Record<string, { icon: typeof AlertTriangle; className: string }> = {
  critical: { icon: AlertTriangle, className: "text-destructive" },
  warning: { icon: AlertCircle, className: "text-amber-600" },
  info: { icon: Info, className: "text-blue-500" },
};

export function AlertsFeed({ lojaId, isAdmin }: AlertsFeedProps) {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["audit-alerts", lojaId],
    queryFn: async () => {
      let query = supabase
        .from("audit_alerts")
        .select("*")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (lojaId) {
        query = query.eq("loja_id", lojaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AuditAlert[];
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("audit_alerts")
        .update({ is_read: true })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-alerts"] });
    },
  });

  if (isLoading || alerts.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-600" />
          Alertas
          <Badge variant="secondary" className="text-xs ml-auto">
            {alerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <ScrollArea className="max-h-[160px]">
          <div className="space-y-2">
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity] || severityConfig.info;
              const Icon = config.icon;

              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 rounded-md border bg-background p-2.5 text-sm"
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.className}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs leading-snug">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(alert.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => markAsRead.mutate(alert.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
