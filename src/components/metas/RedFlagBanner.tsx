import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";
import { calcMetaStatus, calcNpsStatus, calcConformidadeStatus, calcCmvCarnesStatus, calcCmvSalmaoStatus } from "@/lib/metasUtils";
import { cn } from "@/lib/utils";

/** Métricas avaliadas para detectar Red Flag. */
const METRICS = [
  { key: "nps", label: "NPS", meta: 120000, redFlag: 70000, polarity: "higher" as const, status: calcNpsStatus },
  { key: "cmv_salmao", label: "CMV Salmão", meta: 1.55, redFlag: 1.90, polarity: "lower" as const, status: calcCmvSalmaoStatus },
  { key: "cmv_carnes", label: "CMV Carnes", meta: 0.6, redFlag: 2.0, polarity: "lower" as const, status: calcCmvCarnesStatus },
  { key: "kds", label: "KDS", meta: 5, redFlag: 10, polarity: "lower" as const, status: null },
  { key: "conformidade", label: "Conformidade", meta: 90, redFlag: 75, polarity: "higher" as const, status: calcConformidadeStatus },
] as const;

/**
 * sessionStorage key lido pelo RankingView para pré-selecionar a métrica.
 */
const RANKING_METRIC_HINT_KEY = "metas:ranking-metric";

export function RedFlagBanner() {
  const { isAdmin, isOperator, isGerenteUnidade, roles, isLoading } = useUserProfile();
  const { data, isLoading: loadingMetas } = useMetasSnapshot();
  const navigate = useNavigate();

  // diretor (caso a role exista) também é elegível
  const isDiretor = roles.includes("diretor" as any);

  const canSee = isAdmin || isOperator || isGerenteUnidade || isDiretor;

  const alerts = useMemo(() => {
    if (!canSee || !data.length) return [];
    const map = new Map<string, { metricKey: string; metricLabel: string; lojas: string[] }>();

    for (const spec of METRICS) {
      const offenders: string[] = [];
      for (const row of data) {
        const value = (row as any)[spec.key] as number | null;
        if (typeof value !== "number") continue;
        const status = spec.status
          ? spec.status(value)
          : calcMetaStatus(value, spec.meta, spec.redFlag, spec.polarity);
        if (status === "redflag" || row.red_flag) offenders.push(row.loja_codigo);
      }
      if (offenders.length) {
        map.set(spec.key, {
          metricKey: spec.key,
          metricLabel: spec.label,
          lojas: Array.from(new Set(offenders)),
        });
      }
    }

    return Array.from(map.values());
  }, [canSee, data]);

  if (isLoading || loadingMetas || !canSee || alerts.length === 0) return null;

  const totalLojas = new Set(alerts.flatMap((a) => a.lojas)).size;
  // Métrica primária = a que tiver mais ofensores
  const primary = [...alerts].sort((a, b) => b.lojas.length - a.lojas.length)[0];

  const handleClick = () => {
    try {
      sessionStorage.setItem(RANKING_METRIC_HINT_KEY, primary.metricKey);
    } catch {
      /* noop */
    }
    navigate("/?tab=painel&view=ranking&metric=" + encodeURIComponent(primary.metricKey));
  };

  return (
    <AnimatePresence>
      <motion.button
        type="button"
        onClick={handleClick}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        whileHover={{ y: -1 }}
        className={cn(
          "group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
          "border-b border-red-500/20",
        )}
        style={{
          background:
            "linear-gradient(90deg, rgba(239,68,68,0.18), rgba(239,68,68,0.06) 60%, rgba(239,68,68,0.18))",
        }}
        aria-label="Abrir ranking com filtro de Red Flag"
      >
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/25 ring-1 ring-red-500/50"
        >
          <AlertTriangle className="h-4 w-4 text-red-200" />
        </motion.span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-red-200">
            Red Flag ativo · {totalLojas} {totalLojas === 1 ? "loja" : "lojas"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-red-100/80">
            <span className="font-semibold text-red-100">{primary.metricLabel}</span>
            {" · "}
            {primary.lojas.slice(0, 4).join(", ")}
            {primary.lojas.length > 4 && ` +${primary.lojas.length - 4}`}
            {alerts.length > 1 && (
              <span className="ml-2 text-red-200/70">
                · {alerts.length - 1} outra(s) métrica(s) em alerta
              </span>
            )}
          </p>
        </div>

        <span className="hidden items-center gap-1 text-[11px] font-semibold text-red-100 transition-transform group-hover:translate-x-0.5 sm:inline-flex">
          Ver ranking
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </motion.button>
    </AnimatePresence>
  );
}

export { RANKING_METRIC_HINT_KEY };
