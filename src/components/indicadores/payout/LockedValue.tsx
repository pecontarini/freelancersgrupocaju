import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const BRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  value: number | null | undefined;
  canSee: boolean;
  placeholder?: string;
  /** se true não envolve em tooltip (útil dentro de outros tooltips) */
  noTooltip?: boolean;
  className?: string;
}

export function LockedValue({ value, canSee, placeholder = "●●●", noTooltip, className }: Props) {
  if (canSee) {
    return <span className={className}>{BRL(value)}</span>;
  }
  const masked = (
    <span
      className={`cj-locked ${className ?? ""}`}
      aria-label="Valor de pagamento oculto - disponível apenas para administradores"
    >
      <Lock className="h-3 w-3 cj-locked-icon" />
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
