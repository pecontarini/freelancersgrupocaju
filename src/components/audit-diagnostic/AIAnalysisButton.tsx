import { useState } from "react";
import { Sparkles, Loader2, Copy, Printer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { SupervisionFailure } from "@/hooks/useSupervisionAudits";
import {
  categorizeItemToSector,
  SECTOR_POSITION_MAP,
} from "@/lib/sectorPositionMapping";

interface AIAnalysisButtonProps {
  failures: SupervisionFailure[];
  unitName: string;
  periodLabel: string;
  avgScore: number | null;
}

interface AIAnalysis {
  resumo_executivo: string;
  padroes: { titulo: string; descricao: string }[];
  causas_raiz: { causa: string; evidencia: string; setores_afetados: string[] }[];
  recomendacoes: { acao: string; prioridade: "alta" | "media" | "baixa"; responsavel: string }[];
}

const prioridadeColors: Record<string, string> = {
  alta: "bg-destructive/10 text-destructive border-destructive/20",
  media: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  baixa: "bg-muted text-muted-foreground border-border",
};

export function AIAnalysisButton({
  failures,
  unitName,
  periodLabel,
  avgScore,
}: AIAnalysisButtonProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setOpen(true);

    try {
      // Prepare failures with sector info
      const enrichedFailures = failures.map((f) => {
        const sector = categorizeItemToSector(f.item_name, f.category);
        return {
          item_name: f.item_name,
          sector: SECTOR_POSITION_MAP[sector]?.displayName || sector,
          detalhes: f.detalhes_falha || "",
          is_recurring: f.is_recurring,
        };
      });

      const { data, error: fnError } = await supabase.functions.invoke(
        "analyze-audit-patterns",
        {
          body: {
            failures: enrichedFailures,
            unitName,
            periodLabel,
            avgScore,
          },
        }
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data);
    } catch (e: any) {
      const msg = e?.message || "Erro ao analisar padrões";
      setError(msg);
      toast({
        title: "Erro na análise",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!analysis) return;
    const text = [
      "ANÁLISE DE AUDITORIA — " + unitName,
      "Período: " + periodLabel,
      "",
      "RESUMO EXECUTIVO",
      analysis.resumo_executivo,
      "",
      "PADRÕES IDENTIFICADOS",
      ...analysis.padroes.map((p, i) => `${i + 1}. ${p.titulo}: ${p.descricao}`),
      "",
      "CAUSAS RAIZ",
      ...analysis.causas_raiz.map(
        (c, i) =>
          `${i + 1}. ${c.causa} — ${c.evidencia} (Setores: ${c.setores_afetados.join(", ")})`
      ),
      "",
      "RECOMENDAÇÕES",
      ...analysis.recomendacoes.map(
        (r, i) => `${i + 1}. [${r.prioridade.toUpperCase()}] ${r.acao} → ${r.responsavel}`
      ),
    ].join("\n");

    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Análise copiada para a área de transferência" });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleAnalyze}
        disabled={isLoading || failures.length === 0}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Analisar com IA</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Análise Inteligente
              </DialogTitle>
              {analysis && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
                    <Printer className="h-3.5 w-3.5" />
                    Imprimir
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Analisando padrões...</p>
                  <p className="text-sm text-muted-foreground">
                    {failures.length} falha{failures.length !== 1 ? "s" : ""} em análise
                  </p>
                </div>
              </div>
            )}

            {error && !isLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={handleAnalyze}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {analysis && !isLoading && (
              <div className="space-y-6 pr-4">
                {/* Resumo Executivo */}
                <div>
                  <h3 className="text-sm font-semibold uppercase text-primary mb-2">
                    Resumo Executivo
                  </h3>
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                    {analysis.resumo_executivo}
                  </p>
                </div>

                <Separator />

                {/* Padrões */}
                {analysis.padroes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase text-primary mb-3">
                      Padrões Identificados
                    </h3>
                    <div className="space-y-3">
                      {analysis.padroes.map((p, i) => (
                        <div key={i} className="rounded-lg border p-3">
                          <p className="text-sm font-medium">{p.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-1">{p.descricao}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Causas Raiz */}
                {analysis.causas_raiz.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase text-primary mb-3">
                      Causas Raiz Sugeridas
                    </h3>
                    <div className="space-y-3">
                      {analysis.causas_raiz.map((c, i) => (
                        <div key={i} className="rounded-lg border p-3">
                          <p className="text-sm font-medium">{c.causa}</p>
                          <p className="text-xs text-muted-foreground mt-1">{c.evidencia}</p>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {c.setores_afetados.map((s) => (
                              <Badge key={s} variant="outline" className="text-xs">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Recomendações */}
                {analysis.recomendacoes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase text-primary mb-3">
                      Recomendações Priorizadas
                    </h3>
                    <div className="space-y-2">
                      {analysis.recomendacoes.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-lg border p-3"
                        >
                          <Badge
                            variant="outline"
                            className={`text-xs shrink-0 ${prioridadeColors[r.prioridade] || ""}`}
                          >
                            {r.prioridade.toUpperCase()}
                          </Badge>
                          <div className="min-w-0">
                            <p className="text-sm">{r.acao}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Responsável: {r.responsavel}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
