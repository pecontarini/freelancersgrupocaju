import { useMemo } from "react";
import { format } from "date-fns";
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useReclamacoes } from "@/hooks/useReclamacoes";
import { useActionPlans } from "@/hooks/useActionPlans";
import type { ConfigOption } from "@/hooks/useConfigOptions";

interface UnitSummaryGridProps {
  lojas: ConfigOption[];
  onSelectLoja: (lojaId: string) => void;
  currentMonth: string;
}

// Brand detection
const BRAND_COLORS: Record<string, string> = {
  caju: "border-l-amber-500",
  caminito: "border-l-red-500",
  nazo: "border-l-purple-500",
  fosters: "border-l-blue-500",
  default: "border-l-muted-foreground",
};

function getBrandColor(storeName: string): string {
  const name = storeName.toLowerCase();
  if (name.includes("caju")) return BRAND_COLORS.caju;
  if (name.includes("caminito") || name.startsWith("mult")) return BRAND_COLORS.caminito;
  if (name.includes("nazo") || name.startsWith("nfe")) return BRAND_COLORS.nazo;
  if (name.includes("foster") || name.startsWith("fb")) return BRAND_COLORS.fosters;
  return BRAND_COLORS.default;
}

function UnitCard({
  loja,
  onClick,
  currentMonth,
}: {
  loja: ConfigOption;
  onClick: () => void;
  currentMonth: string;
}) {
  const { reclamacoes } = useReclamacoes(loja.id, currentMonth);
  const { actionPlans } = useActionPlans(loja.id, currentMonth);

  const stats = useMemo(() => {
    const total = reclamacoes.length;
    const graves = reclamacoes.filter((r) => r.is_grave).length;
    const pending = actionPlans.filter((ap) => ap.status === "pending").length;
    const inAnalysis = actionPlans.filter((ap) => ap.status === "in_analysis").length;
    const resolved = actionPlans.filter((ap) => ap.status === "resolved").length;
    const late = actionPlans.filter(
      (ap) => ap.status === "pending" && new Date(ap.deadline_at) < new Date()
    ).length;

    const totalPlans = actionPlans.length;
    const resolutionRate = totalPlans > 0 ? Math.round((resolved / totalPlans) * 100) : 0;

    const hasCritical = graves >= 3 || late > 0;

    return { total, graves, pending, inAnalysis, resolved, late, resolutionRate, hasCritical };
  }, [reclamacoes, actionPlans]);

  const brandColor = getBrandColor(loja.nome);

  return (
    <Card
      className={`rounded-xl cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border-l-4 ${brandColor} ${
        stats.hasCritical ? "ring-1 ring-destructive/50" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm uppercase truncate">{loja.nome}</h3>
            <p className="text-xs text-muted-foreground">
              {stats.total} queixa{stats.total !== 1 ? "s" : ""} no mês
            </p>
          </div>
          {stats.hasCritical && (
            <Badge variant="destructive" className="flex items-center gap-1 flex-shrink-0">
              <Flame className="h-3 w-3" />
              Crítico
            </Badge>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <p className="text-lg font-bold text-destructive">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Pendentes</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-600">{stats.inAnalysis}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Em Análise</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-600">{stats.resolved}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Resolvidos</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Resolução</span>
            <span className="font-medium">{stats.resolutionRate}%</span>
          </div>
          <Progress value={stats.resolutionRate} className="h-1.5" />
        </div>

        {/* Alerts */}
        <div className="flex flex-wrap gap-1 mt-3">
          {stats.late > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              <Clock className="h-2.5 w-2.5 mr-1" />
              {stats.late} atrasado
            </Badge>
          )}
          {stats.graves > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-destructive/10 text-destructive">
              {stats.graves} grave{stats.graves > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Click indicator */}
        <div className="flex items-center justify-end mt-2 text-xs text-muted-foreground">
          <span>Ver detalhes</span>
          <ChevronRight className="h-3 w-3 ml-1" />
        </div>
      </CardContent>
    </Card>
  );
}

export function UnitSummaryGrid({ lojas, onSelectLoja, currentMonth }: UnitSummaryGridProps) {
  if (lojas.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma unidade cadastrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {lojas.map((loja) => (
        <UnitCard
          key={loja.id}
          loja={loja}
          onClick={() => onSelectLoja(loja.id)}
          currentMonth={currentMonth}
        />
      ))}
    </div>
  );
}
