import { CheckCircle, Clock, Camera, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MobileActionPlanCardProps {
  failure: SupervisionFailure;
  isRecurring: boolean;
  isAdmin: boolean;
  onResolve: () => void;
  onValidate: () => void;
}

export function MobileActionPlanCard({
  failure,
  isRecurring,
  isAdmin,
  onResolve,
  onValidate,
}: MobileActionPlanCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-all ${
        isRecurring
          ? "border-destructive/50 bg-destructive/5"
          : failure.status === "resolved"
          ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-border bg-card"
      }`}
    >
      {/* Header with status icon and recurring badge */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {failure.status === "pending" ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <CheckCircle className="h-4 w-4 text-amber-600" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="font-medium text-sm leading-tight flex-1">{failure.item_name}</p>
            {isRecurring && (
              <Badge variant="destructive" className="shrink-0 text-xs gap-1">
                <RefreshCw className="h-3 w-3" />
                Recorrente
              </Badge>
            )}
          </div>
          
          {failure.category && (
            <Badge variant="outline" className="mt-2 text-xs">
              {failure.category}
            </Badge>
          )}
          
          {failure.status === "resolved" && failure.resolved_at && (
            <p className="text-xs text-amber-600 mt-2">
              Corrigido em{" "}
              {format(new Date(failure.resolved_at), "dd/MM 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>
          )}
          
          {failure.resolution_photo_url && (
            <a
              href={failure.resolution_photo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline mt-2 inline-block"
            >
              Ver foto anexada
            </a>
          )}
        </div>
      </div>
      
      {/* Action buttons - touch friendly */}
      <div className="mt-4 flex justify-end">
        {failure.status === "pending" && (
          <Button
            size="lg"
            variant="outline"
            onClick={onResolve}
            className="h-12 min-w-[120px] gap-2"
          >
            <Camera className="h-5 w-5" />
            Resolver
          </Button>
        )}
        {failure.status === "resolved" && isAdmin && (
          <Button
            size="lg"
            onClick={onValidate}
            className="h-12 min-w-[120px] gap-2"
          >
            <CheckCircle className="h-5 w-5" />
            Validar
          </Button>
        )}
      </div>
    </div>
  );
}
