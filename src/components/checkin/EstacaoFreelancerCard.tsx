import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, DollarSign, CheckCircle2, Timer } from "lucide-react";
import { format } from "date-fns";
import type { EstacaoFreelancerItem } from "@/hooks/useEstacaoStatus";

interface Props {
  item: EstacaoFreelancerItem;
  onClick: () => void;
}

const formatTime = (iso?: string | null) => {
  if (!iso) return "";
  try {
    return format(new Date(iso), "HH:mm");
  } catch {
    return "";
  }
};

const formatBRL = (n?: number | null) =>
  n != null ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export function EstacaoFreelancerCard({ item, onClick }: Props) {
  const statusConfig = {
    available: {
      label: "Disponível",
      bg: "bg-primary/10 hover:bg-primary/20 border-primary/40",
      badge: "bg-primary text-primary-foreground",
      icon: User,
    },
    in_service: {
      label: "Em serviço",
      bg: "bg-accent/20 hover:bg-accent/30 border-accent",
      badge: "bg-accent text-accent-foreground",
      icon: Timer,
    },
    done: {
      label: "Concluído",
      bg: "bg-muted hover:bg-muted/80 border-border opacity-70",
      badge: "bg-muted-foreground text-background",
      icon: CheckCircle2,
    },
  }[item.status];

  const Icon = statusConfig.icon;

  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg border-2 ${statusConfig.bg} p-0 overflow-hidden`}
    >
      <div className="p-5 flex flex-col gap-3 h-full">
        {/* Header: Avatar + Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {item.fotoUrl ? (
              <img
                src={item.fotoUrl}
                alt={item.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-background shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center border-2 border-border">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <Badge className={`${statusConfig.badge} text-xs px-2 py-1 whitespace-nowrap`}>
            <Icon className="h-3 w-3 mr-1" /> {statusConfig.label}
          </Badge>
        </div>

        {/* Name + role */}
        <div>
          <h3 className="font-bold text-lg leading-tight line-clamp-2">{item.name}</h3>
          {item.jobTitle && (
            <p className="text-sm text-muted-foreground line-clamp-1">{item.jobTitle}</p>
          )}
        </div>

        {/* Footer: time / value */}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {item.startTime && item.endTime ? (
            <span className="flex items-center gap-1 font-medium">
              <Clock className="h-4 w-4" />
              {item.startTime.slice(0, 5)} – {item.endTime.slice(0, 5)}
            </span>
          ) : item.source === "manual" ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground italic">
              <Clock className="h-3.5 w-3.5" />
              Lançamento manual — sem horário
            </span>
          ) : null}

          {item.checkedInAt && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              Entrada {formatTime(item.checkedInAt)}
              {item.checkedOutAt ? ` · Saída ${formatTime(item.checkedOutAt)}` : ""}
            </span>
          )}

          {item.agreedRate != null && (
            <span className="flex items-center gap-1 font-semibold text-primary ml-auto">
              <DollarSign className="h-4 w-4" />
              {formatBRL(item.agreedRate)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
