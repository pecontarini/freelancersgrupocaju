import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import type { ActionPlanStatus } from "@/hooks/useActionPlans";

interface ActionPlanStatusBadgeProps {
  status: ActionPlanStatus;
  deadlineAt?: string;
  className?: string;
}

export function ActionPlanStatusBadge({ status, deadlineAt, className }: ActionPlanStatusBadgeProps) {
  const isLate = deadlineAt && new Date(deadlineAt) < new Date() && status === "pending";
  
  if (isLate) {
    return (
      <Badge variant="destructive" className={`gap-1 ${className}`}>
        <AlertCircle className="h-3 w-3" />
        ATRASADO
      </Badge>
    );
  }

  switch (status) {
    case "pending":
      return (
        <Badge variant="destructive" className={`gap-1 ${className}`}>
          <Clock className="h-3 w-3" />
          PENDENTE
        </Badge>
      );
    case "in_analysis":
      return (
        <Badge className={`gap-1 bg-amber-500 hover:bg-amber-600 ${className}`}>
          <Clock className="h-3 w-3" />
          EM ANÁLISE
        </Badge>
      );
    case "resolved":
      return (
        <Badge className={`gap-1 bg-emerald-500 hover:bg-emerald-600 ${className}`}>
          <CheckCircle2 className="h-3 w-3" />
          RESOLVIDO
        </Badge>
      );
    default:
      return null;
  }
}
