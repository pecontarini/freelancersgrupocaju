import { motion } from "framer-motion";
import { Target, Sparkles, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUnidade } from "@/contexts/UnidadeContext";
import { MetaCard, type MetaCardProps } from "@/components/metas/MetaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";
import {
  calcNpsStatus,
  calcConformidadeStatus,
  calcMetaStatus,
  calcMetaPercentual,
  calcCmvCarnesStatus,
  calcCmvSalmaoStatus,
  formatNpsDisplay,
} from "@/lib/metasUtils";
import { useMemo } from "react";
import { AppGlassBackground } from "@/components/layout/AppGlassBackground";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";

interface MetricSpec {
  titulo: string;
  tipo: string;
  meta: number;
  redFlag: number;
  polarity: "higher" | "lower";
  unidadeSufixo?: string;
  pick: (r: any) => number | null;
}

const METRIC_SPECS: MetricSpec[] = [
  {
    titulo: "NPS Salão",
    tipo: "Experiência",
    meta: 120000,
    redFlag: 70000,
    polarity: "higher",
    pick: (r) => r.nps,
  },
  {
    titulo: "CMV Salmão",
    tipo: "kg por R$1k vendido",
    meta: 1.55,
    redFlag: 1.90,
    polarity: "lower",
    unidadeSufixo: "kg",
    pick: (r) => r.cmv_salmao,
  },
  {
    titulo: "CMV Carnes",
    tipo: "% desvio s/ transferido",
    meta: 0.6,
    redFlag: 2.0,
    polarity: "lower",
    unidadeSufixo: "%",
    pick: (r) => r.cmv_carnes,
  },
  {
    titulo: "Conformidade Auditoria",
    tipo: "Operação",
    meta: 90,
    redFlag: 75,
    polarity: "higher",
    unidadeSufixo: "%",
    pick: (r) => r.conformidade,
  },
  {
    titulo: "KDS · Tempo de Prato",
    tipo: "% pratos black target",
    meta: 5,
    redFlag: 10,
    polarity: "lower",
    unidadeSufixo: "%",
    pick: (r) => r.kds,
  },
];

function avg(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export default function MetasPage() {
  const navigate = useNavigate();
  const { profile, roles, unidade, isLoading: loadingProfile } = useUserProfile();
  const { selectedUnidadeId, setSelectedUnidadeId } = useUnidade();
  const cargo = roles[0] ?? "employee";
  const { data, isLoading, isEmpty, error } = useMetasSnapshot();

  const metas: MetaCardProps[] = useMemo(() => {
    if (!data.length) return [];
    return METRIC_SPECS.map((spec) => {
      const value = avg(data.map(spec.pick));
      let status: MetaCardProps["status"];
      if (spec.titulo.startsWith("NPS")) {
        status = calcNpsStatus(value);
      } else if (spec.titulo.startsWith("Conformidade")) {
        status = calcConformidadeStatus(value);
      } else if (spec.titulo === "CMV Carnes") {
        status = calcCmvCarnesStatus(value);
      } else if (spec.titulo === "CMV Salmão") {
        status = calcCmvSalmaoStatus(value);
      } else {
        status = calcMetaStatus(value, spec.meta, spec.redFlag, spec.polarity);
      }
      const percentual = calcMetaPercentual(value, spec.meta, spec.polarity);
      const isNps = spec.titulo.startsWith("NPS");
      return {
        titulo: spec.titulo,
        tipo: spec.tipo,
        valorAtual: value ?? 0,
        valorMeta: spec.meta,
        percentual,
        status,
        redFlag: status === "redflag",
        unidadeSufixo: spec.unidadeSufixo ?? "",
        formatValor: isNps ? formatNpsDisplay : undefined,
        formatMeta: isNps ? formatNpsDisplay : undefined,
      };
    });
  }, [data]);

  const hasRealData = !isLoading && !isEmpty && metas.length > 0;

  return (
    <SidebarProvider>
      <AppGlassBackground />
      <div className="flex min-h-screen w-full">
        <AppSidebar activeTab="painel" onTabChange={(tab) => navigate(`/?tab=${tab}`)} />
        <SidebarInset>
          <PortalHeader
            title="Painel de Metas"
            subtitle="Acompanhamento de indicadores estratégicos"
            selectedUnidadeId={selectedUnidadeId}
            onUnidadeChange={setSelectedUnidadeId}
          />

          <main className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-card mb-8 flex flex-wrap items-center justify-between gap-4 p-6"
              style={{
                background:
                  "linear-gradient(135deg, rgba(245,158,11,0.10), rgba(255,255,255,0.02))",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    background: "linear-gradient(135deg, #F59E0B, #D05937)",
                    boxShadow: "0 8px 24px -8px rgba(245,158,11,0.5)",
                  }}
                >
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="font-[Sora] text-2xl font-bold tracking-tight text-white">
                    Painel de Metas
                  </h1>
                  <p className="font-[DM_Sans] text-sm text-white/60">
                    {loadingProfile
                      ? "Carregando perfil…"
                      : `${profile?.full_name ?? "Líder"} · ${cargo} ${unidade?.nome ? `· ${unidade.nome}` : ""}`}
                  </p>
                </div>
              </div>

              {hasRealData && (
                <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-emerald-300 ring-1 ring-emerald-500/30">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="font-[DM_Sans]">Sincronizado</span>
                </div>
              )}
            </motion.header>

            {/* Loading */}
            {isLoading && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 w-full rounded-2xl bg-white/5" />
                ))}
              </div>
            )}

            {/* Error */}
            {!isLoading && error && (
              <div className="glass-card flex flex-col items-center gap-2 p-10 text-center text-red-300 ring-1 ring-red-500/30">
                <p className="font-[Sora] text-sm font-semibold">Erro ao carregar metas</p>
                <p className="text-xs text-white/60">{error}</p>
              </div>
            )}

            {/* Empty */}
            {!isLoading && !error && isEmpty && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card flex flex-col items-center gap-3 p-12 text-center ring-1 ring-amber-500/20"
              >
                <Clock className="h-10 w-10 text-amber-400" />
                <div>
                  <p className="font-[Sora] text-base font-semibold text-white">
                    Aguardando sincronização semanal
                  </p>
                  <p className="mt-1 font-[DM_Sans] text-sm text-white/60">
                    Os snapshots de metas ainda não foram gerados para este mês.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Grid */}
            {hasRealData && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {metas.map((m, i) => (
                  <motion.div
                    key={m.titulo}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.4 }}
                  >
                    <MetaCard {...m} />
                  </motion.div>
                ))}
              </div>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
