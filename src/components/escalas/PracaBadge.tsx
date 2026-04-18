import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

interface PracaBadgeProps {
  nome?: string | null;
  size?: "xs" | "sm";
  className?: string;
}

/**
 * Visual chip for the praça assigned to a schedule row.
 * Coral/primary tint when filled, muted/outline when missing.
 */
export function PracaBadge({ nome, size = "xs", className = "" }: PracaBadgeProps) {
  const text = size === "xs" ? "text-[9px]" : "text-[10px]";
  if (!nome) {
    return (
      <Badge
        variant="outline"
        className={`gap-0.5 px-1 py-0 border-dashed text-muted-foreground ${text} ${className}`}
      >
        <MapPin className="h-2.5 w-2.5" />
        Sem praça
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={`gap-0.5 px-1 py-0 border-primary/40 bg-primary/10 text-primary ${text} ${className}`}
    >
      <MapPin className="h-2.5 w-2.5" />
      <span className="truncate max-w-[110px]">{nome}</span>
    </Badge>
  );
}
