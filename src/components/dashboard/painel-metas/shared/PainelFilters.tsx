import { useMemo } from "react";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOJA_DISPLAY, getLojaDisplay } from "@/lib/lojaUtils";

export type BrandFilter = "all" | "CJ" | "CP" | "NZ" | "FB";
export type PeriodFilter = "current" | "prev" | "delta";

interface Props {
  brand: BrandFilter;
  onBrandChange: (b: BrandFilter) => void;
  loja: string | "all";
  onLojaChange: (l: string | "all") => void;
  period?: PeriodFilter;
  onPeriodChange?: (p: PeriodFilter) => void;
  /** Restringe seleção a uma única loja (ex.: gerente_unidade). */
  lockedLoja?: string | null;
  className?: string;
}

const BRAND_LABEL: Record<BrandFilter, string> = {
  all: "Todas as marcas",
  CJ: "Caju Limão",
  CP: "Caminito Parrilla",
  NZ: "Nazo Japanese",
  FB: "Foster's Burguer",
};

export function PainelFilters({
  brand,
  onBrandChange,
  loja,
  onLojaChange,
  period,
  onPeriodChange,
  lockedLoja,
  className,
}: Props) {
  const lojas = useMemo(() => {
    const all = Object.keys(LOJA_DISPLAY).sort();
    if (brand === "all") return all;
    return all.filter((c) => c.startsWith(`${brand}_`));
  }, [brand]);

  if (lockedLoja) {
    const d = getLojaDisplay(lockedLoja);
    return (
      <div className={cn("flex items-center gap-2 text-xs text-foreground/80", className)}>
        <Filter className="h-3.5 w-3.5" />
        <span>Visualizando:</span>
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/30">
          {d.nome}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        Filtros
      </div>

      <Select value={brand} onValueChange={(v) => onBrandChange(v as BrandFilter)}>
        <SelectTrigger className="vision-glass h-8 w-[180px] border-border text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(BRAND_LABEL) as BrandFilter[]).map((b) => (
            <SelectItem key={b} value={b} className="text-xs">
              {BRAND_LABEL[b]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={loja} onValueChange={onLojaChange}>
        <SelectTrigger className="vision-glass h-8 w-[200px] border-border text-xs">
          <SelectValue placeholder="Loja" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            Todas as lojas
          </SelectItem>
          {lojas.map((c) => (
            <SelectItem key={c} value={c} className="text-xs">
              {getLojaDisplay(c).nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {period && onPeriodChange && (
        <Select value={period} onValueChange={(v) => onPeriodChange(v as PeriodFilter)}>
          <SelectTrigger className="vision-glass h-8 w-[180px] border-border text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current" className="text-xs">Mês corrente</SelectItem>
            <SelectItem value="prev" className="text-xs">Mês anterior</SelectItem>
            <SelectItem value="delta" className="text-xs">Variação Δ</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
