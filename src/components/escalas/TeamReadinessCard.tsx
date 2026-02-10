import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { usePendingConfirmations } from "@/hooks/usePendingConfirmations";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamReadinessCardProps {
  onNavigate: () => void;
}

export function TeamReadinessCard({ onNavigate }: TeamReadinessCardProps) {
  const { data, isLoading } = usePendingConfirmations();
  const tomorrow = addDays(new Date(), 1);
  const formattedDate = format(tomorrow, "EEEE, dd/MM", { locale: ptBR });

  const hasRisk = (data?.pending ?? 0) > 0 || (data?.denied ?? 0) > 0;
  const allConfirmed = (data?.total ?? 0) > 0 && (data?.pending ?? 0) === 0 && (data?.denied ?? 0) === 0;

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
      onClick={onNavigate}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          hasRisk ? "bg-destructive/10" : allConfirmed ? "bg-green-500/10" : "bg-muted"
        }`}>
          {hasRisk ? (
            <AlertTriangle className="h-6 w-6 text-destructive" />
          ) : allConfirmed ? (
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          ) : (
            <CalendarClock className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Prontidão de Equipe</p>
          <p className="text-xs text-muted-foreground capitalize">{formattedDate}</p>

          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mt-1" />
          ) : (data?.total ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5">Nenhuma escala para amanhã</p>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              {(data?.pending ?? 0) > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  ⚠️ {data!.pending} Pendente{data!.pending > 1 ? "s" : ""}
                </Badge>
              )}
              {(data?.denied ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {data!.denied} Ausência{data!.denied > 1 ? "s" : ""}
                </Badge>
              )}
              {allConfirmed && (
                <Badge className="text-[10px] px-1.5 py-0 bg-green-600 text-white">
                  ✓ {data!.confirmed} Confirmado{data!.confirmed > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          )}
        </div>

        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </CardContent>
    </Card>
  );
}
