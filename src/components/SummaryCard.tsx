import { DollarSign, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface SummaryCardProps {
  totalValue: number;
  totalEntries: number;
  uniqueFreelancers: number;
}

export function SummaryCard({
  totalValue,
  totalEntries,
  uniqueFreelancers,
}: SummaryCardProps) {
  return (
    <div className="summary-card text-primary-foreground fade-in">
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-sm opacity-90">
          <DollarSign className="h-4 w-4" />
          Custo Total Consolidado
        </div>
        <div className="mt-2 text-4xl font-bold tracking-tight">
          {formatCurrency(totalValue)}
        </div>
        
        <div className="mt-6 flex gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/20">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs opacity-80">Lançamentos</div>
              <div className="font-semibold">{totalEntries}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/20">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs opacity-80">Freelancers</div>
              <div className="font-semibold">{uniqueFreelancers}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
