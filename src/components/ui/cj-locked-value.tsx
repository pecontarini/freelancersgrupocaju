import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const BRL = (v: number | null | undefined) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      });

export interface CJLockedValueProps {
  value: number | null | undefined;
  canSee: boolean;
  placeholder?: string;
  /** evita aninhar tooltip dentro de outro tooltip */
  noTooltip?: boolean;
  className?: string;
}

/**
 * Esconde valores R$ pra não-admin.
 * canSee=true → "R$ 1.500"
 * canSee=false → "R$ ●●●" + lock + tooltip
 */
export function CJLockedValue({
  value,
  canSee,
  placeholder = "●●●",
  noTooltip,
  className,
}: CJLockedValueProps) {
  if (canSee) {
    return <span className={cn("tabular", className)}>{BRL(value)}</span>;
  }

  const masked = (
    <span
      className={cn("cj-locked", className)}
      aria-label="Valor de pagamento oculto - disponível apenas para administradores"
    >
      <Lock className="cj-locked-icon h-3 w-3" aria-hidden="true" />
      R$ {placeholder}
    </span>
  );

  if (noTooltip) return masked;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{masked}</TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Disponível apenas para administradores</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default CJLockedValue;
