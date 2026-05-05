import { ReactNode, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FileSpreadsheet, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HistoricoUploads } from "./HistoricoUploads";
import { UploadIndicadorModal } from "./UploadIndicadorModal";
import { useIndicadoresHistorico, useIndicadoresSnapshot } from "@/hooks/useIndicadoresSnapshot";
import { INDICADOR_LABELS } from "@/lib/indicadores-parsers";
import { EmptyState } from "./shared";
import { Skeleton } from "@/components/ui/skeleton";

interface Props<T> {
  metaKey: string;
  title?: string;
  subtitle?: string;
  render: (
    dados: T,
    meta: { referenciaLabel: string; arquivoNome: string; createdAt: string; referenciaMes: string },
  ) => ReactNode;
}

export function IndicadorDashboardShell<T = any>({ metaKey, title, subtitle, render }: Props<T>) {
  const [referenciaMes, setReferenciaMes] = useState<string | undefined>(undefined);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data: historico } = useIndicadoresHistorico(metaKey);

  useEffect(() => {
    if (!referenciaMes && historico && historico.length > 0) {
      setReferenciaMes(historico[0].referenciaMes);
    }
  }, [historico, referenciaMes]);

  const { data: snap, isLoading } = useIndicadoresSnapshot<T>(metaKey, referenciaMes);

  return (
    <div className="space-y-5">
      {/* Header glass */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_4px_20px_rgba(245,158,11,0.35)]">
              <FileSpreadsheet className="h-5 w-5 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {title ?? INDICADOR_LABELS[metaKey] ?? metaKey}
              </h2>
              {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
              {snap?.meta && (
                <p className="text-xs text-white/40 mt-1">
                  Ativo: <span className="font-medium text-amber-400">{snap.meta.referenciaLabel}</span>
                  {" · "}{snap.meta.linhasImportadas} registros
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={() => setUploadOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" /> Upload
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5">
          <HistoricoUploads
            metaKey={metaKey}
            referenciaMes={referenciaMes}
            onChange={setReferenciaMes}
          />
        </div>
      </motion.div>

      {/* Body */}
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full bg-white/5" />
          <Skeleton className="h-64 w-full bg-white/5" />
        </div>
      )}

      {!isLoading && !snap && (
        <EmptyState
          icon={BarChart2}
          title={`Nenhum dado disponível${referenciaMes ? ` para ${referenciaMes}` : ""}`}
          onUpload={() => setUploadOpen(true)}
        />
      )}

      <AnimatePresence mode="wait">
        {!isLoading && snap && (
          <motion.div
            key={snap.meta.referenciaMes}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {render(snap.dados, {
              referenciaLabel: snap.meta.referenciaLabel,
              arquivoNome: snap.meta.arquivoNome,
              createdAt: snap.meta.createdAt,
              referenciaMes: snap.meta.referenciaMes,
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <UploadIndicadorModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultMetaKey={metaKey}
      />
    </div>
  );
}
