// Tela de revisão da importação determinística da planilha "Escala Mínima".
// Substitui (para .xlsx) o caminho de IA: lê a planilha, mostra o que foi
// detectado por unidade e só salva no banco depois que o COO confirmar.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTOR_LABELS, type SectorKey } from "@/lib/holding/sectors";
import type {
  ResolvedUnit,
  ResolveResult,
} from "@/lib/holding/unit-sheet-resolver";

const DAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

interface MinimumScaleImportReviewProps {
  result: ResolveResult;
  monthYear: string;
  selectedUnitIds: Set<string>;
  onApplied: () => void;
}

interface UnitApplyState {
  status: "idle" | "applying" | "applied" | "failed";
  applied?: number;
  error?: string;
}

export function MinimumScaleImportReview({
  result,
  monthYear,
  selectedUnitIds,
  onApplied,
}: MinimumScaleImportReviewProps) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyState, setApplyState] = useState<Record<string, UnitApplyState>>({});

  // Apenas unidades selecionadas pelo usuário
  const eligible = useMemo(
    () => result.resolved.filter((u) => selectedUnitIds.has(u.unitId)),
    [result.resolved, selectedUnitIds],
  );
  const missingSelected = useMemo(
    () => result.missing.filter((u) => selectedUnitIds.has(u.unitId)),
    [result.missing, selectedUnitIds],
  );

  const totals = useMemo(() => {
    const cells = eligible.reduce((s, u) => s + u.cells.length, 0);
    const warnings = eligible.reduce((s, u) => s + u.warnings.length, 0);
    return { cells, warnings, ready: eligible.length, missing: missingSelected.length };
  }, [eligible, missingSelected]);

  const toggleExpand = (unitId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const applyOne = async (unit: ResolvedUnit) => {
    setApplyState((s) => ({ ...s, [unit.unitId]: { status: "applying" } }));
    let ok = 0;
    let fail = 0;
    for (const c of unit.cells) {
      const { error } = await supabase
        .from("holding_staffing_config")
        .upsert(
          {
            unit_id: unit.unitId,
            brand: unit.brand,
            sector_key: c.sector_key,
            shift_type: c.shift_type,
            day_of_week: c.day_of_week,
            month_year: monthYear,
            required_count: c.required_count,
            extras_count: c.extras_count,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "unit_id,sector_key,shift_type,day_of_week,month_year" },
        );
      if (error) fail++;
      else ok++;
    }
    setApplyState((s) => ({
      ...s,
      [unit.unitId]:
        fail === 0
          ? { status: "applied", applied: ok }
          : { status: "failed", error: `${fail} de ${ok + fail} falharam.`, applied: ok },
    }));
  };

  const applyAll = async () => {
    if (!eligible.length) return;
    setApplying(true);
    for (const u of eligible) {
      // pula já aplicadas
      if (applyState[u.unitId]?.status === "applied") continue;
      // eslint-disable-next-line no-await-in-loop
      await applyOne(u);
    }
    setApplying(false);
    qc.invalidateQueries({ queryKey: ["holding_staffing_config"] });
    toast.success("Importação concluída.");
    onApplied();
  };

  return (
    <div className="space-y-3">
      {/* Resumo */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <div className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Resumo da leitura
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Stat label="Unidades prontas" value={totals.ready} tone="ok" />
          <Stat label="Células válidas" value={totals.cells} />
          <Stat
            label="Sem dados"
            value={totals.missing}
            tone={totals.missing > 0 ? "warn" : "neutral"}
          />
          <Stat
            label="Alertas"
            value={totals.warnings + result.orphanSheets.length}
            tone={
              totals.warnings + result.orphanSheets.length > 0 ? "warn" : "neutral"
            }
          />
        </div>
      </div>

      {/* Unidades sem dados */}
      {missingSelected.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">
            <AlertTriangle className="h-3 w-3" />
            Unidades selecionadas sem dados na planilha
          </div>
          <div className="text-[11px] text-foreground/80 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
            {missingSelected.map((u) => (
              <div key={u.unitId} className="truncate uppercase">
                · {u.unitName}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Estas unidades NÃO serão alteradas. Adicione manualmente ou anexe
            uma planilha que cubra esses nomes.
          </div>
        </div>
      )}

      {/* Avisos de abas órfãs */}
      {result.orphanSheets.length > 0 && (
        <details className="rounded-lg border border-border/60 bg-background/40 p-2 text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">
            {result.orphanSheets.length} aviso(s) de aba/bloco descartado
          </summary>
          <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
            {result.orphanSheets.slice(0, 30).map((o, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{o.sheetName}</span>
                : {o.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Lista por unidade */}
      <div className="space-y-1.5">
        {eligible.map((u) => {
          const st = applyState[u.unitId];
          const isOpen = expanded.has(u.unitId);
          return (
            <div
              key={u.unitId}
              className={cn(
                "rounded-lg border bg-background/60 transition-colors",
                st?.status === "applied" && "border-emerald-500/40 bg-emerald-500/5",
                st?.status === "failed" && "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="flex items-center gap-2 p-2.5">
                <button
                  type="button"
                  onClick={() => toggleExpand(u.unitId)}
                  className="rounded p-0.5 hover:bg-muted text-foreground"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate uppercase">
                    {u.unitName}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {u.brand} · origem: {u.sourceSheets.join(", ") || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {u.cells.length} célula(s)
                  </Badge>
                  {st?.status === "applied" && (
                    <Badge className="text-[10px] gap-1 bg-emerald-700 hover:bg-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> aplicada
                    </Badge>
                  )}
                  {st?.status === "applying" && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> aplicando
                    </Badge>
                  )}
                  {st?.status === "failed" && (
                    <Badge variant="destructive" className="text-[10px] gap-1">
                      <XCircle className="h-3 w-3" /> falhou
                    </Badge>
                  )}
                </div>
              </div>
              {st?.status === "failed" && st.error && (
                <div className="px-3 pb-2 text-[11px] text-destructive">{st.error}</div>
              )}
              {isOpen && <ResolvedUnitPreview unit={u} />}
            </div>
          );
        })}
      </div>

      {/* Footer ação */}
      <div className="sticky bottom-0 -mx-1 px-1 pt-2 pb-1 border-t border-border/60 bg-background/80 backdrop-blur-md">
        <Button
          onClick={applyAll}
          disabled={applying || eligible.length === 0}
          className="w-full h-10"
        >
          {applying ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Aplicando importação...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-1.5" />
              Aplicar importação validada ({totals.cells} células · {totals.ready} unidade
              {totals.ready === 1 ? "" : "s"})
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "neutral";
}) {
  return (
    <div className="rounded-md border border-border/40 bg-background/60 px-2 py-1.5">
      <div
        className={cn(
          "text-base font-bold tabular-nums",
          tone === "ok" && "text-emerald-700 dark:text-emerald-400",
          tone === "warn" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ResolvedUnitPreview({ unit }: { unit: ResolvedUnit }) {
  // agrupa células por sector_key + shift
  const grid = useMemo(() => {
    const bySector = new Map<SectorKey, Map<string, string>>();
    for (const c of unit.cells) {
      if (!bySector.has(c.sector_key)) bySector.set(c.sector_key, new Map());
      const m = bySector.get(c.sector_key)!;
      const key = `${c.shift_type}|${c.day_of_week}`;
      m.set(
        key,
        c.extras_count > 0
          ? `${c.required_count}+${c.extras_count}`
          : `${c.required_count}`,
      );
    }
    return bySector;
  }, [unit]);

  return (
    <div className="border-t border-border/40 bg-muted/20 p-2 overflow-x-auto">
      {unit.warnings.length > 0 && (
        <div className="mb-1.5 text-[10px] text-amber-700 dark:text-amber-400">
          {unit.warnings.slice(0, 4).map((w, i) => (
            <div key={i}>· {w}</div>
          ))}
        </div>
      )}
      <table className="w-full text-[10px] tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-medium px-1 py-0.5">Setor / Turno</th>
            {DAY_LABELS.map((d) => (
              <th key={d} className="px-1 py-0.5 font-medium">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(grid.entries()).map(([sector, cells]) => (
            <>
              <tr key={`${sector}-a`} className="border-t border-border/30">
                <td className="px-1 py-0.5 text-foreground/80">
                  {SECTOR_LABELS[sector]} · ALMOÇO
                </td>
                {DAY_LABELS.map((_, dow) => (
                  <td key={dow} className="px-1 py-0.5 text-center">
                    {cells.get(`almoco|${dow}`) ?? "—"}
                  </td>
                ))}
              </tr>
              <tr key={`${sector}-j`}>
                <td className="px-1 py-0.5 text-foreground/80">
                  {SECTOR_LABELS[sector]} · JANTAR
                </td>
                {DAY_LABELS.map((_, dow) => (
                  <td key={dow} className="px-1 py-0.5 text-center">
                    {cells.get(`jantar|${dow}`) ?? "—"}
                  </td>
                ))}
              </tr>
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
