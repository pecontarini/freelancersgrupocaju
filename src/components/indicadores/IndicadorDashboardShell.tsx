import { ReactNode, useState, useEffect } from "react";
import { Plus, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HistoricoUploads } from "./HistoricoUploads";
import { UploadIndicadorModal } from "./UploadIndicadorModal";
import { useIndicadoresHistorico, useIndicadoresSnapshot } from "@/hooks/useIndicadoresSnapshot";
import { INDICADOR_LABELS, formatReferenciaLabel } from "@/lib/indicadores-parsers";

interface Props<T> {
  metaKey: string;
  title?: string;
  subtitle?: string;
  render: (dados: T, meta: { referenciaLabel: string; arquivoNome: string; createdAt: string }) => ReactNode;
}

export function IndicadorDashboardShell<T = any>({ metaKey, title, subtitle, render }: Props<T>) {
  const [referenciaMes, setReferenciaMes] = useState<string | undefined>(undefined);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data: historico } = useIndicadoresHistorico(metaKey);

  // Default = mais recente
  useEffect(() => {
    if (!referenciaMes && historico && historico.length > 0) {
      setReferenciaMes(historico[0].referenciaMes);
    }
  }, [historico, referenciaMes]);

  const { data: snap, isLoading } = useIndicadoresSnapshot<T>(metaKey, referenciaMes);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200/60 bg-white/60 backdrop-blur-md p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{title ?? INDICADOR_LABELS[metaKey] ?? metaKey}</h2>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
              {snap?.meta && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Período ativo: <span className="font-medium text-amber-700">{snap.meta.referenciaLabel}</span>
                  {" "}• {snap.meta.linhasImportadas} registros
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={() => setUploadOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" /> Upload
          </Button>
        </div>

        <div className="mt-3 pt-3 border-t border-amber-200/40">
          <HistoricoUploads
            metaKey={metaKey}
            referenciaMes={referenciaMes}
            onChange={setReferenciaMes}
          />
        </div>
      </div>

      {isLoading && (
        <div className="rounded-xl border bg-white/40 backdrop-blur-md p-8 text-center text-sm text-muted-foreground">
          Carregando dados…
        </div>
      )}

      {!isLoading && !snap && (
        <div className="rounded-xl border border-dashed bg-white/40 backdrop-blur-md p-10 text-center">
          <FileSpreadsheet className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-medium">Nenhum upload disponível</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique em <strong>Upload</strong> para enviar a primeira planilha deste indicador.
          </p>
        </div>
      )}

      {!isLoading && snap && (
        <div>{render(snap.dados, {
          referenciaLabel: snap.meta.referenciaLabel,
          arquivoNome: snap.meta.arquivoNome,
          createdAt: snap.meta.createdAt,
        })}</div>
      )}

      <UploadIndicadorModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultMetaKey={metaKey}
      />
    </div>
  );
}
