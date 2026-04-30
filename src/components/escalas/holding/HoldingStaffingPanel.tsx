import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";
import {
  useHoldingStaffingConfig,
  useUpsertHoldingStaffing,
  useEffectiveHeadcountBySector,
  type HoldingStaffingConfigRow,
  type RegimeType,
} from "@/hooks/useHoldingConfig";
import {
  DAYS_OF_WEEK_DISPLAY,
  SECTOR_LABELS,
  SHIFT_TYPES,
  sectorsForBrand,
  type Brand,
  type SectorKey,
} from "@/lib/holding/sectors";
import { useHoldingFreelancerBudgetCalc } from "@/hooks/useHoldingFreelancerBudgetCalc";
import { cn } from "@/lib/utils";

interface Props {
  brand: Brand;
  unitId: string;
  monthYear: string;
}

/* ─────────── helpers (lógica intocada) ─────────── */

function defaultRegimeFor(sector: SectorKey): RegimeType {
  return sector === "sushi" ? "6x1" : "5x2";
}
function calcDobras(soma: number, regime: RegimeType): number {
  if (regime === "5x2") return (soma * 2) / 10;
  return soma / 9.5;
}
function pessoasFromDobras(dobras: number): number {
  return Math.ceil(dobras);
}
function parseCellValue(raw: string): { required: number; extras: number } {
  const s = (raw ?? "").trim();
  if (!s) return { required: 0, extras: 0 };
  const m = s.match(/^\s*(-?\d+)?\s*(?:\+\s*(-?\d+))?\s*$/);
  if (!m) return { required: 0, extras: 0 };
  const req = Math.max(0, Math.floor(Number(m[1] ?? 0) || 0));
  const ext = Math.max(0, Math.floor(Number(m[2] ?? 0) || 0));
  return { required: req, extras: ext };
}
function formatCellValue(required: number, extras: number): string {
  if (extras > 0) return `${required}+${extras}`;
  return String(required);
}

/* ─────────── estilos compartilhados (Liquid Glass — sem cores novas) ─────────── */

const glassCardStyle: React.CSSProperties = {
  background: "var(--glass-bg)",
  backdropFilter: "var(--glass-blur, blur(24px)) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "0.5px solid var(--glass-border)",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--glass-shadow)",
};

const glassPillBg = "rgba(255,255,255,0.55)";

export function HoldingStaffingPanel({ brand, unitId, monthYear }: Props) {
  const { data: rows, isLoading } = useHoldingStaffingConfig(unitId, monthYear);
  const { data: effectiveBySector } = useEffectiveHeadcountBySector(unitId);
  const upsert = useUpsertHoldingStaffing();
  const sectors = sectorsForBrand(brand);
  const [showExtras, setShowExtras] = useState(false);

  // Regime override local (até persistir): `${sector}|${shift}` -> regime
  const [regimeOverride, setRegimeOverride] = useState<Record<string, RegimeType>>({});

  // Estado de colapso por setor (todos abertos por padrão)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapsed = (sector: SectorKey) =>
    setCollapsed((p) => ({ ...p, [sector]: !p[sector] }));

  // index: `${sector_key}|${shift_type}|${day}` -> row
  const index = useMemo(() => {
    const m = new Map<string, HoldingStaffingConfigRow>();
    (rows ?? []).forEach((r) => {
      m.set(`${r.sector_key}|${r.shift_type}|${r.day_of_week}`, r);
    });
    return m;
  }, [rows]);

  const getRequired = (sector: SectorKey, shift: "almoco" | "jantar", day: number) =>
    index.get(`${sector}|${shift}|${day}`)?.required_count ?? 0;
  const getExtras = (sector: SectorKey, shift: "almoco" | "jantar", day: number) =>
    index.get(`${sector}|${shift}|${day}`)?.extras_count ?? 0;

  const getRegime = (sector: SectorKey, shift: "almoco" | "jantar"): RegimeType => {
    const k = `${sector}|${shift}`;
    if (regimeOverride[k]) return regimeOverride[k];
    for (const d of DAYS_OF_WEEK_DISPLAY) {
      const r = index.get(`${sector}|${shift}|${d.key}`);
      if (r?.regime) return r.regime;
    }
    return defaultRegimeFor(sector);
  };

  const persistCell = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    day: number,
    required: number,
    extras: number,
    regime?: RegimeType,
  ) => {
    upsert.mutate({
      unit_id: unitId,
      brand,
      sector_key: sector,
      shift_type: shift,
      day_of_week: day,
      month_year: monthYear,
      required_count: Math.max(0, Math.floor(required || 0)),
      extras_count: Math.max(0, Math.floor(extras || 0)),
      regime: regime ?? getRegime(sector, shift),
    });
  };

  const handleRequiredBlur = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    day: number,
    raw: string,
  ) => {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    if (value === getRequired(sector, shift, day)) return;
    persistCell(sector, shift, day, value, getExtras(sector, shift, day));
  };
  const handleExtrasBlur = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    day: number,
    raw: string,
  ) => {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    if (value === getExtras(sector, shift, day)) return;
    persistCell(sector, shift, day, getRequired(sector, shift, day), value);
  };
  const handleCombinedBlur = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    day: number,
    raw: string,
  ) => {
    const { required, extras } = parseCellValue(raw);
    const curReq = getRequired(sector, shift, day);
    const curExt = getExtras(sector, shift, day);
    if (required === curReq && extras === curExt) return;
    persistCell(sector, shift, day, required, extras);
  };

  const handleRegimeChange = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    next: RegimeType,
  ) => {
    const k = `${sector}|${shift}`;
    setRegimeOverride((prev) => ({ ...prev, [k]: next }));
    for (const d of DAYS_OF_WEEK_DISPLAY) {
      persistCell(
        sector,
        shift,
        d.key,
        getRequired(sector, shift, d.key),
        getExtras(sector, shift, d.key),
        next,
      );
    }
  };

  // Métricas por linha (setor × turno)
  const rowMetrics = useMemo(() => {
    const out: Record<
      string,
      { soma: number; somaReq: number; somaExt: number; dobras5x2: number; dobras6x1: number }
    > = {};
    for (const sector of sectors) {
      for (const shift of SHIFT_TYPES) {
        let somaReq = 0;
        let somaExt = 0;
        for (const d of DAYS_OF_WEEK_DISPLAY) {
          somaReq += getRequired(sector, shift.key, d.key);
          somaExt += getExtras(sector, shift.key, d.key);
        }
        const soma = somaReq + somaExt;
        out[`${sector}|${shift.key}`] = {
          soma,
          somaReq,
          somaExt,
          dobras5x2: calcDobras(soma, "5x2"),
          dobras6x1: calcDobras(soma, "6x1"),
        };
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectors, index]);

  // Pico semanal por setor (req+ext) p/ Necess./Efet./Gap
  const metricsBySector = useMemo(() => {
    const out: Record<string, { necessarias: number; dobras: number }> = {};
    for (const sector of sectors) {
      let maxTotal = 0;
      let maxExtras = 0;
      for (const d of DAYS_OF_WEEK_DISPLAY) {
        const aTot = getRequired(sector, "almoco", d.key) + getExtras(sector, "almoco", d.key);
        const jTot = getRequired(sector, "jantar", d.key) + getExtras(sector, "jantar", d.key);
        const ea = getExtras(sector, "almoco", d.key);
        const ej = getExtras(sector, "jantar", d.key);
        maxTotal = Math.max(maxTotal, aTot, jTot);
        maxExtras = Math.max(maxExtras, ea, ej);
      }
      out[sector] = { necessarias: maxTotal, dobras: maxExtras };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectors, index]);

  // Soma agregada para o summary bar
  const summary = useMemo(() => {
    let necessarias = 0;
    let efetivas = 0;
    let setoresOk = 0;
    let setoresGap = 0;
    for (const sector of sectors) {
      const m = metricsBySector[sector] ?? { necessarias: 0, dobras: 0 };
      const ef = effectiveBySector?.[sector] ?? 0;
      necessarias += m.necessarias;
      efetivas += ef;
      const gap = m.necessarias - ef;
      if (gap <= 0) setoresOk += 1;
      else setoresGap += 1;
    }
    const gapTotal = necessarias - efetivas;
    return { necessarias, efetivas, gapTotal, setoresOk, setoresGap, total: sectors.length };
  }, [sectors, metricsBySector, effectiveBySector]);

  /* ─────────── renderizadores auxiliares ─────────── */

  const renderGapPill = (gap: number) => {
    let bg = "hsl(var(--muted) / 0.7)";
    let color = "hsl(var(--muted-foreground))";
    let label = "OK";
    if (gap > 0) {
      bg = "hsl(var(--destructive) / 0.15)";
      color = "hsl(var(--destructive))";
      label = `Faltam ${gap}`;
    } else if (gap < 0) {
      bg = "hsl(38 92% 50% / 0.15)";
      color = "hsl(38 92% 35%)";
      label = `Excedente ${Math.abs(gap)}`;
    } else {
      bg = "hsl(142 71% 45% / 0.15)";
      color = "hsl(142 71% 30%)";
      label = "OK";
    }
    return (
      <span
        className="inline-flex items-center font-semibold tabular-nums"
        style={{
          background: bg,
          color,
          borderRadius: "var(--radius-pill)",
          fontSize: 11,
          fontWeight: 600,
          padding: "4px 12px",
          letterSpacing: "0.01em",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    );
  };

  const renderRegimeToggle = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    active: RegimeType,
  ) => {
    const Btn = ({ value }: { value: RegimeType }) => {
      const isActive = active === value;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRegimeChange(sector, shift, value);
          }}
          style={{
            background: isActive ? "hsl(var(--primary))" : "transparent",
            color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
            opacity: isActive ? 1 : 0.45,
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow: isActive ? "0 1px 4px hsl(var(--primary) / 0.35)" : "none",
            letterSpacing: "0.01em",
          }}
        >
          {value}
        </button>
      );
    };
    return (
      <div
        className="inline-flex items-center"
        style={{
          background: "rgba(0,0,0,0.07)",
          borderRadius: 8,
          padding: 2,
          gap: 2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Btn value="5x2" />
        <Btn value="6x1" />
      </div>
    );
  };

  /* ─────────── grade interna de um turno ─────────── */

  const renderShiftGrid = (sector: SectorKey, shift: "almoco" | "jantar") => {
    const regime = getRegime(sector, shift);
    const rm = rowMetrics[`${sector}|${shift}`] ?? {
      soma: 0,
      somaReq: 0,
      somaExt: 0,
      dobras5x2: 0,
      dobras6x1: 0,
    };
    const dobrasAtivas = regime === "5x2" ? rm.dobras5x2 : rm.dobras6x1;
    const pessoas = pessoasFromDobras(dobrasAtivas);

    return (
      <div className="space-y-1">
        {/* Label de turno */}
        <div
          className="uppercase tracking-wide"
          style={{ fontSize: 10, fontWeight: 500, opacity: 0.4, letterSpacing: "0.06em" }}
        >
          {SHIFT_TYPES.find((s) => s.key === shift)?.label}
        </div>

        {/* Cabeçalho de dias + 1ª linha de inputs */}
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: "64px repeat(7, 1fr) 90px",
            gap: 4,
          }}
        >
          {/* Coluna vazia (alinha com input) */}
          <div />
          {DAYS_OF_WEEK_DISPLAY.map((d) => {
            const isWeekend = d.key === 5 || d.key === 6 || d.key === 0; // Sex/Sáb/Dom
            return (
              <div
                key={`hd-${d.key}`}
                className="text-center uppercase"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "hsl(var(--foreground))",
                  opacity: isWeekend ? 1 : 0.35,
                }}
              >
                {d.label}
              </div>
            );
          })}
          <div
            className="text-center uppercase"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              opacity: 0.55,
              color: "hsl(var(--foreground))",
            }}
          >
            Pessoas
          </div>

          {/* Label "Mín." na coluna fixa */}
          <div
            className="text-center uppercase"
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.06em",
              opacity: 0.5,
              color: "hsl(var(--foreground))",
            }}
          >
            {showExtras ? "Mín." : "Mín+Ext"}
          </div>

          {/* Inputs Seg–Dom */}
          {DAYS_OF_WEEK_DISPLAY.map((d) => {
            const isWeekend = d.key === 5 || d.key === 6 || d.key === 0;
            const reqVal = getRequired(sector, shift, d.key);
            const extVal = getExtras(sector, shift, d.key);
            const combined = formatCellValue(reqVal, extVal);

            const baseStyle: React.CSSProperties = {
              background: isWeekend
                ? "hsl(var(--primary) / 0.08)"
                : "rgba(255,255,255,0.52)",
              border: isWeekend
                ? "0.5px solid hsl(var(--primary) / 0.25)"
                : "0.5px solid var(--glass-border-subtle)",
              borderRadius: "var(--radius-cell)",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 500,
              padding: "5px 2px",
              outline: "none",
              transition: "all 0.15s ease",
              width: "100%",
              color: "hsl(var(--foreground))",
            };

            const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.88)";
              e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.5)";
              e.currentTarget.style.boxShadow = "0 0 0 3px hsl(var(--primary) / 0.14)";
            };
            const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
              e.currentTarget.style.background = baseStyle.background as string;
              e.currentTarget.style.borderColor = isWeekend
                ? "hsl(var(--primary) / 0.25)"
                : "var(--glass-border-subtle)";
              e.currentTarget.style.boxShadow = "none";
            };

            const cell = showExtras ? (
              <div className="flex flex-col items-center gap-0.5">
                <input
                  type="number"
                  min={0}
                  defaultValue={reqVal}
                  key={`req-${sector}-${shift}-${d.key}-${reqVal}`}
                  onFocus={onFocus}
                  onBlur={(e) => {
                    onBlur(e);
                    handleRequiredBlur(sector, shift, d.key, e.target.value);
                  }}
                  style={baseStyle}
                  className="tabular-nums max-lg:text-[9px]"
                />
                <input
                  type="number"
                  min={0}
                  defaultValue={extVal}
                  key={`ext-${sector}-${shift}-${d.key}-${extVal}`}
                  onFocus={onFocus}
                  onBlur={(e) => {
                    onBlur(e);
                    handleExtrasBlur(sector, shift, d.key, e.target.value);
                  }}
                  placeholder="+0"
                  style={{ ...baseStyle, fontSize: 10, opacity: 0.7, padding: "3px 2px" }}
                  className="tabular-nums max-lg:text-[9px]"
                />
              </div>
            ) : (
              <input
                type="text"
                inputMode="numeric"
                defaultValue={combined}
                key={`comb-${sector}-${shift}-${d.key}-${combined}`}
                onFocus={onFocus}
                onBlur={(e) => {
                  onBlur(e);
                  handleCombinedBlur(sector, shift, d.key, e.target.value);
                }}
                placeholder="0"
                title="Formato: X+Y (ex.: 4+1 = 4 mínimos + 1 extra)"
                style={{
                  ...baseStyle,
                  fontWeight: extVal > 0 ? 700 : 500,
                }}
                className="tabular-nums max-lg:text-[9px]"
              />
            );

            return (
              <Tooltip key={`cell-${d.key}`}>
                <TooltipTrigger asChild>
                  <div className="w-full">{cell}</div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="space-y-0.5">
                    <div>
                      Soma semanal: <strong>{rm.soma}</strong>
                    </div>
                    <div className={cn(regime === "5x2" && "font-semibold text-primary")}>
                      5x2: {rm.dobras5x2.toFixed(1)} dobras → {pessoasFromDobras(rm.dobras5x2)} pessoas
                    </div>
                    <div className={cn(regime === "6x1" && "font-semibold text-primary")}>
                      6x1: {rm.dobras6x1.toFixed(1)} dobras → {pessoasFromDobras(rm.dobras6x1)} pessoas
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Célula resultado */}
          <div
            className="flex flex-col items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.35)",
              border: "0.5px solid rgba(255,255,255,0.60)",
              borderRadius: "var(--radius-cell)",
              padding: "4px 6px",
              color: "hsl(var(--foreground))",
            }}
          >
            <span
              className="tabular-nums"
              style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.1 }}
            >
              {pessoas}
            </span>
            <span style={{ fontSize: 9, opacity: 0.4, lineHeight: 1.1 }}>
              {regime} · {dobrasAtivas.toFixed(1)}d
            </span>
          </div>
        </div>
      </div>
    );
  };

  /* ─────────── card de setor ─────────── */

  const renderSectorCard = (sector: SectorKey) => {
    const isCollapsed = !!collapsed[sector];
    const m = metricsBySector[sector] ?? { necessarias: 0, dobras: 0 };
    const efetivas = effectiveBySector?.[sector] ?? 0;
    const gap = m.necessarias - efetivas;

    // Para o Nº pessoas no header: usamos o pico (almoço × jantar) com regime ativo
    const rmA = rowMetrics[`${sector}|almoco`] ?? { dobras5x2: 0, dobras6x1: 0 };
    const rmJ = rowMetrics[`${sector}|jantar`] ?? { dobras5x2: 0, dobras6x1: 0 };
    const regimeA = getRegime(sector, "almoco");
    const regimeJ = getRegime(sector, "jantar");
    const pessA = pessoasFromDobras(regimeA === "5x2" ? rmA.dobras5x2 : rmA.dobras6x1);
    const pessJ = pessoasFromDobras(regimeJ === "5x2" ? rmJ.dobras5x2 : rmJ.dobras6x1);
    const headerPessoas = Math.max(pessA, pessJ);

    // Dobras header (somar almoço + jantar para visão geral)
    const totalDobras5x2 = rmA.dobras5x2 + rmJ.dobras5x2;
    const totalDobras6x1 = rmA.dobras6x1 + rmJ.dobras6x1;
    // Regime "ativo" no header: o predominante (almoço); usa-se para destacar
    const headerRegime = regimeA;

    return (
      <div
        key={sector}
        style={{ ...glassCardStyle, marginBottom: 10, overflow: "hidden", transition: "box-shadow 0.2s ease" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 12px 40px rgba(0,0,0,0.13)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--glass-shadow)";
        }}
      >
        {/* HEADER */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleCollapsed(sector)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCollapsed(sector);
            }
          }}
          className="flex items-center"
          style={{
            padding: "13px 18px",
            gap: 10,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {/* Nome */}
          <span
            className="uppercase max-lg:text-[12px]"
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.2px",
              minWidth: 150,
              color: "hsl(var(--foreground))",
            }}
          >
            {SECTOR_LABELS[sector]}
          </span>

          {/* Nº pessoas */}
          <span
            className="tabular-nums"
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.5px",
              color: "hsl(var(--foreground))",
              minWidth: 36,
            }}
          >
            {headerPessoas}
          </span>

          {/* Dobras sobrepostas */}
          <div className="flex flex-col leading-tight" style={{ minWidth: 70 }}>
            <span
              className="tabular-nums"
              style={{
                fontSize: 11,
                fontWeight: headerRegime === "5x2" ? 600 : 400,
                opacity: headerRegime === "5x2" ? 1 : 0.4,
                color: "hsl(var(--muted-foreground))",
              }}
            >
              5×2: {totalDobras5x2.toFixed(1)}
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: 11,
                fontWeight: headerRegime === "6x1" ? 600 : 400,
                opacity: headerRegime === "6x1" ? 1 : 0.4,
                color: "hsl(var(--muted-foreground))",
              }}
            >
              6×1: {totalDobras6x1.toFixed(1)}
            </span>
          </div>

          {/* Toggle 5x2 / 6x1 (aplica em ambos os turnos via almoço — mantém UX) */}
          <div style={{ marginLeft: "auto" }} className="flex items-center gap-2.5">
            {/* Mostramos um único toggle visual; ele troca o regime de "almoco" como referência principal. 
                Cada turno mantém regime independente — para granularidade fina, expandir o card. */}
            {renderRegimeToggle(sector, "almoco", regimeA)}

            {/* Gap pill */}
            {renderGapPill(gap)}

            {/* Chevron */}
            <ChevronDown
              size={14}
              style={{
                opacity: 0.4,
                transition: "transform 0.2s ease",
                transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)",
              }}
            />
          </div>
        </div>

        {/* BODY */}
        <div
          style={{
            background: "rgba(255,255,255,0.18)",
            borderTop: isCollapsed ? "none" : "0.5px solid rgba(255,255,255,0.50)",
            maxHeight: isCollapsed ? 0 : 600,
            opacity: isCollapsed ? 0 : 1,
            overflow: "hidden",
            transition: "max-height 0.25s ease, opacity 0.2s ease, border-top-color 0.2s ease",
            padding: isCollapsed ? "0 18px" : "12px 18px 16px",
          }}
        >
          {renderShiftGrid(sector, "almoco")}

          {/* Separador */}
          <div
            style={{
              height: "0.5px",
              background: "rgba(255,255,255,0.50)",
              margin: "10px 0",
            }}
          />

          {renderShiftGrid(sector, "jantar")}

          {/* Mini-resumo (Necess. / Efet.) */}
          <div
            className="flex items-center justify-end gap-4 mt-3 text-[11px]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <span>
              Necessárias: <strong className="tabular-nums" style={{ color: "hsl(var(--foreground))" }}>{m.necessarias}</strong>
            </span>
            <span>
              Efetivas: <strong className="tabular-nums" style={{ color: "hsl(var(--foreground))" }}>{efetivas}</strong>
            </span>
          </div>
        </div>
      </div>
    );
  };

  /* ─────────── summary bar ─────────── */

  const SummaryCard = ({
    label,
    value,
    sub,
    valueColor,
  }: {
    label: string;
    value: string | number;
    sub?: string;
    valueColor?: string;
  }) => (
    <div style={{ ...glassCardStyle, padding: "14px 18px" }}>
      <div
        className="uppercase"
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          opacity: 0.55,
          color: "hsl(var(--foreground))",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        className="tabular-nums max-lg:text-[22px]"
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-1px",
          color: valueColor ?? "hsl(var(--foreground))",
          lineHeight: 1.1,
          marginTop: 4,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: "hsl(var(--muted-foreground))",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Cabeçalho descritivo + switch */}
      <div
        className="flex items-start justify-between flex-wrap gap-3"
        style={{ ...glassCardStyle, padding: "12px 20px" }}
      >
        <div>
          <div
            className="uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.06em",
              opacity: 0.55,
              color: "hsl(var(--foreground))",
              fontWeight: 600,
            }}
          >
            Mínimo Operacional
          </div>
          <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
            Use <strong>X+Y</strong> em cada célula (ex.: <code>4+1</code> = 4 mínimos + 1 extra fixo).
          </div>
        </div>
        <div
          className="flex items-center gap-2"
          style={{
            background: glassPillBg,
            border: "0.5px solid var(--glass-border-subtle)",
            borderRadius: "var(--radius-inner)",
            padding: "6px 10px",
          }}
        >
          <Switch id="show-extras" checked={showExtras} onCheckedChange={setShowExtras} />
          <Label htmlFor="show-extras" className="text-xs cursor-pointer">
            Editar extras separadamente
          </Label>
        </div>
      </div>

      {/* SUMMARY BAR */}
      <div
        className="grid gap-2.5"
        style={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        }}
      >
        <div className="contents max-lg:hidden">
          <SummaryCard label="Necessárias (pico)" value={summary.necessarias} sub="Soma dos picos por setor" />
          <SummaryCard label="Efetivas (CLT)" value={summary.efetivas} sub="Headcount efetivo atual" />
          <SummaryCard
            label="Gap total"
            value={summary.gapTotal > 0 ? `-${summary.gapTotal}` : summary.gapTotal === 0 ? "0" : `+${Math.abs(summary.gapTotal)}`}
            sub={summary.gapTotal > 0 ? "Faltam pessoas" : summary.gapTotal === 0 ? "Equilibrado" : "Excedente"}
            valueColor={
              summary.gapTotal > 0
                ? "hsl(var(--destructive))"
                : summary.gapTotal === 0
                ? "hsl(142 71% 30%)"
                : "hsl(38 92% 35%)"
            }
          />
          <SummaryCard
            label="Setores OK"
            value={`${summary.setoresOk}/${summary.total}`}
            sub={summary.setoresGap > 0 ? `${summary.setoresGap} com gap` : "Todos cobertos"}
          />
        </div>
        {/* Mobile: 2x2 grid */}
        <div className="lg:hidden col-span-4 grid grid-cols-2 gap-2.5">
          <SummaryCard label="Necessárias" value={summary.necessarias} />
          <SummaryCard label="Efetivas" value={summary.efetivas} />
          <SummaryCard
            label="Gap"
            value={summary.gapTotal}
            valueColor={
              summary.gapTotal > 0
                ? "hsl(var(--destructive))"
                : summary.gapTotal === 0
                ? "hsl(142 71% 30%)"
                : "hsl(38 92% 35%)"
            }
          />
          <SummaryCard label="Setores OK" value={`${summary.setoresOk}/${summary.total}`} />
        </div>
      </div>

      {/* CARDS DE SETOR */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <TooltipProvider delayDuration={150}>
          <div>{sectors.map((s) => renderSectorCard(s))}</div>
        </TooltipProvider>
      )}

      <p className="text-[10px] text-muted-foreground italic px-1">
        Célula <strong>X+Y</strong>: X = mínimo CLT, Y = extras pré-definidos pelo COO. Soma semanal usa X+Y.
        Regime: 5x2 → dobras = (soma×2)/10 • 6x1 → dobras = soma/9,5 • Nº Pessoas = arredondamento p/ cima.
        Gap = pico semanal (mínimo + extras) − CLT efetivos.
      </p>
    </div>
  );
}
