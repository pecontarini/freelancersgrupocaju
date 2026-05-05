import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getLojaDisplay } from "@/lib/lojaUtils";
import {
  METRIC_META,
  statusFor,
  variation,
  type RankingMetric,
} from "./mockLojas";
import type { MetaSnapshotRow } from "@/hooks/useMetasSnapshot";
import { formatNpsDisplay } from "@/lib/metasUtils";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lojaCodigo: string | null;
  metric: RankingMetric | null;
  snapshot: MetaSnapshotRow | null;
}

const STATUS_BADGE: Record<string, string> = {
  excelente: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  bom: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  regular: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  redflag: "bg-red-500/15 text-red-300 ring-red-500/40",
};

const STATUS_LABEL: Record<string, string> = {
  excelente: "Excelente",
  bom: "Bom",
  regular: "Regular",
  redflag: "Red Flag",
};

function formatVal(metric: RankingMetric, value: number | null) {
  if (value === null) return "—";
  if (metric === "nps") return formatNpsDisplay(value);
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function MetricDrawer({ open, onOpenChange, lojaCodigo, metric, snapshot }: Props) {
  if (!lojaCodigo || !metric || !snapshot) return null;

  const meta = METRIC_META[metric];
  const display = getLojaDisplay(lojaCodigo);
  const value =
    metric === "nps"
      ? snapshot.nps
      : metric === "cmv-salmao"
      ? snapshot.cmv_salmao
      : metric === "cmv-carnes"
      ? snapshot.cmv_carnes
      : metric === "kds"
      ? snapshot.kds
      : snapshot.conformidade;
  const prev =
    metric === "nps"
      ? snapshot.nps_anterior
      : metric === "cmv-salmao"
      ? snapshot.cmv_salmao_anterior
      : metric === "cmv-carnes"
      ? snapshot.cmv_carnes_anterior
      : metric === "kds"
      ? snapshot.kds_anterior
      : snapshot.conformidade_anterior;
  const status = statusFor(metric, value);
  const delta = variation(metric, value, prev);
  const isUp = delta > 0.01;
  const isDown = delta < -0.01;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="vision-glass w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-3 pb-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ring-1 ring-white/15"
              style={{ backgroundColor: `${display.cor}30`, color: display.cor }}
            >
              {display.sigla}
            </span>
            <div className="min-w-0">
              <SheetTitle className="text-left text-base">{display.nome}</SheetTitle>
              <SheetDescription className="text-left text-[11px]">
                {meta.label}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
              Valor atual
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-[Sora] text-4xl font-bold text-white">
                {formatVal(metric, value)}
              </span>
              <span className="text-sm text-white/50">{meta.suffix}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={cn("ring-1", STATUS_BADGE[status])}
              >
                {STATUS_LABEL[status]}
              </Badge>
              {snapshot.red_flag && (
                <Badge variant="outline" className="bg-red-500/15 text-red-300 ring-1 ring-red-500/40">
                  <AlertTriangle className="mr-1 h-3 w-3" /> Red Flag ativo
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Meta
              </p>
              <p className="mt-1 font-[Sora] text-xl font-bold tabular-nums">
                {meta.meta}
                <span className="ml-1 text-xs text-white/50">{meta.suffix}</span>
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Mês anterior
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="font-[Sora] text-xl font-bold tabular-nums">
                  {formatVal(metric, prev)}
                </p>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[11px] tabular-nums",
                    isUp && "text-emerald-300",
                    isDown && "text-red-300",
                    !isUp && !isDown && "text-white/40",
                  )}
                >
                  {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {snapshot.observacoes && (
            <div className="rounded-xl bg-white/[0.03] p-3 text-xs text-white/70 ring-1 ring-white/10">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                Observações
              </p>
              {snapshot.observacoes}
            </div>
          )}

          <div className="rounded-xl bg-primary/5 p-3 text-[11px] text-white/60 ring-1 ring-primary/20">
            Atualizado em {new Date(snapshot.updated_at).toLocaleString("pt-BR")}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
