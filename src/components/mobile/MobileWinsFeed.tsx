import { useMemo, useRef } from "react";
import { 
  Rocket, 
  AlertTriangle, 
  CheckCircle2, 
  Trophy,
  TrendingUp,
  Clock,
  Bell,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FeedEvent {
  id: string;
  type: "win" | "alert" | "info";
  icon: React.ElementType;
  title: string;
  description: string;
  timestamp: Date;
}

interface MobileWinsFeedProps {
  events: FeedEvent[];
  variant?: "carousel" | "compact";
}

export function MobileWinsFeed({ events, variant = "carousel" }: MobileWinsFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const getEventStyle = (type: FeedEvent["type"]) => {
    switch (type) {
      case "win":
        return {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500",
          iconBg: "bg-emerald-500/20",
          iconColor: "text-emerald-500",
        };
      case "alert":
        return {
          bg: "bg-amber-500/10",
          border: "border-amber-500",
          iconBg: "bg-amber-500/20",
          iconColor: "text-amber-500",
        };
      default:
        return {
          bg: "bg-muted/50",
          border: "border-muted-foreground",
          iconBg: "bg-muted",
          iconColor: "text-muted-foreground",
        };
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.offsetWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum evento recente</p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="space-y-2">
        {events.slice(0, 5).map((event) => {
          const style = getEventStyle(event.type);
          const Icon = event.icon;
          
          return (
            <div
              key={event.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border-l-4",
                style.bg,
                style.border
              )}
            >
              <div className={cn("shrink-0 p-1.5 rounded-md", style.iconBg)}>
                <Icon className={cn("h-4 w-4", style.iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{event.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(event.timestamp, { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Scroll buttons */}
      {events.length > 2 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}
      
      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-1 py-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {events.map((event) => {
          const style = getEventStyle(event.type);
          const Icon = event.icon;
          
          return (
            <div
              key={event.id}
              className={cn(
                "shrink-0 w-[280px] snap-start rounded-xl border-l-4 p-4",
                style.bg,
                style.border
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("shrink-0 p-2 rounded-lg", style.iconBg)}>
                  <Icon className={cn("h-5 w-5", style.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-2">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {event.description}
                  </p>
                  <Badge variant="outline" className="text-[10px] mt-2">
                    {formatDistanceToNow(event.timestamp, { addSuffix: true, locale: ptBR })}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
