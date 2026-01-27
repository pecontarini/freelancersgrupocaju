import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface BonusDetail {
  label: string;
  amount: number;
  tier: string | null;
  tierLabel: string;
  color: string;
}

interface MobileBonusResultProps {
  isRedFlag: boolean;
  redFlagReason?: string;
  totalBonus: number;
  details: BonusDetail[];
}

export function MobileBonusResult({
  isRedFlag,
  redFlagReason,
  totalBonus,
  details,
}: MobileBonusResultProps) {
  if (isRedFlag) {
    return (
      <div className="mt-6">
        <div className="rounded-2xl bg-gradient-to-r from-red-500/20 to-red-600/10 border-2 border-red-500 p-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm font-bold text-red-500">🚨 RED FLAG</p>
                <p className="text-xs text-muted-foreground">
                  {redFlagReason || "Bônus bloqueado"}
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-500">R$ 0</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="rounded-2xl bg-muted/50 border shadow-md p-4">
        {/* Mini details */}
        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
          {details.map((detail) => (
            <div
              key={detail.label}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-center min-w-[80px]",
                detail.color
              )}
            >
              <p className="text-[10px] text-muted-foreground uppercase">
                {detail.label}
              </p>
              <p className="text-sm font-bold">
                {formatCurrency(detail.amount)}
              </p>
              {detail.tierLabel && (
                <Badge variant="secondary" className="text-[10px] mt-1">
                  {detail.tierLabel}
                </Badge>
              )}
            </div>
          ))}
        </div>
        
        {/* Total */}
        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-sm font-medium text-muted-foreground uppercase">
            Bônus Total
          </p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(totalBonus)}
          </p>
        </div>
      </div>
    </div>
  );
}
