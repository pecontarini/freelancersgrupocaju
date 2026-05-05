import { useState } from "react";
import {
  FileSpreadsheet,
  Link2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
  PlugZap,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSheetsSources, validateSheetsCsvUrl, normalizeSheetsUrl, type SheetsSource } from "@/hooks/useSheetsSources";
import { META_DEFINITIONS } from "@/components/dashboard/painel-metas/shared/metas";
import type { MetaKey } from "@/components/dashboard/painel-metas/shared/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReclamacoesCommentsToggle } from "./ReclamacoesCommentsToggle";

// Definição leve para metas "extras" não presentes em MetaKey
type ExtraMetaDef = { key: string; label: string; description: string };
const EXTRA_LINKABLE_METAS: ExtraMetaDef[] = [
  { key: "target-preto", label: "KDS · Target Preto (Matriz)", description: "Matriz Categoria × Loja com % de target preta" },
  { key: "atendimento-medias", label: "Atendimento — Médias (Google/TripAdvisor/iFood)", description: "Médias por canal — placeholder até popular" },
  { key: "reclamacoes", label: "Reclamações — Distribuição", description: "Distribuição 1–5 estrelas por loja" },
];

// Metas core do MetaKey
const LINKABLE_METAS: MetaKey[] = [
  "visao-geral",
  "nps",
  "cmv-salmao",
  "cmv-carnes",
  "kds",
  "conformidade",
];

interface PreviewState {
  loading: boolean;
  error?: string;
  headers?: string[];
  sampleRows?: string[][];
  rowCount?: number;
}

function MetaSourceCard({
  metaKey,
  source,
  defOverride,
}: {
  metaKey: string;
  source: SheetsSource | null;
  defOverride?: { label: string; description: string };
}) {
  const def = defOverride ?? META_DEFINITIONS[metaKey as MetaKey];
  const { linkSourceToMeta, deleteSource, toggleActive } = useSheetsSources();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(source?.url ?? "");
  const [nome, setNome] = useState(source?.nome ?? def.label);
  const [preview, setPreview] = useState<PreviewState>({ loading: false });

  const validation = url ? validateSheetsCsvUrl(url) : { valid: true };
  const normalizedUrl = url && validation.valid ? normalizeSheetsUrl(url) : null;

  const handleTest = async () => {
    if (!validation.valid || !normalizedUrl) return;
    setPreview({ loading: true });
    try {
      const { data, error } = await supabase.functions.invoke("test-sheet-source", {
        body: { url: normalizedUrl },
      });
      if (error) throw error;
      if (data?.error) {
        setPreview({ loading: false, error: data.error });
      } else {
        setPreview({
          loading: false,
          headers: data.headers,
          sampleRows: data.sampleRows,
          rowCount: data.rowCount,
        });
      }
    } catch (e) {
      setPreview({
        loading: false,
        error: e instanceof Error ? e.message : "Erro ao testar.",
      });
    }
  };

  const handleSave = async () => {
    if (!validation.valid || !normalizedUrl || !nome.trim()) {
      toast.error("Preencha nome e URL válida.");
      return;
    }
    await linkSourceToMeta.mutateAsync({ metaKey, url: normalizedUrl, nome: nome.trim() });
    setOpen(false);
    setPreview({ loading: false });
  };

  const handleSyncNow = async () => {
    if (!source) return;
    try {
      const { data, error } = await supabase.functions.invoke("sync-sheets-staging", {
        body: {
          sourceId: source.id,
          url: source.url,
          referenciaMes: format(new Date(), "yyyy-MM"),
        },
      });
      if (error) throw error;
      if (data?.success === false) {
        toast.error(data.error || "Erro ao sincronizar.");
        return;
      }
      toast.success(
        data?.message ||
          `Sincronizado: ${data?.rowsImported ?? 0} loja(s) atualizadas no Painel.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar.");
    }
  };

  const status = !source
    ? { label: "Não vinculada", tone: "muted" as const }
    : source.ativo
    ? { label: "Ativa", tone: "ok" as const }
    : { label: "Pausada", tone: "warn" as const };

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm uppercase tracking-wide">{def.label}</CardTitle>
            <CardDescription className="text-xs">{def.description}</CardDescription>
          </div>
          <Badge
            variant="outline"
            className={
              status.tone === "ok"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                : status.tone === "warn"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                : "bg-muted text-muted-foreground"
            }
          >
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {source ? (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-xs font-medium truncate">{source.nome}</p>
            <p className="text-xs text-muted-foreground truncate">{source.url}</p>
            <p className="text-[11px] text-muted-foreground">
              Última sync:{" "}
              {source.ultima_sincronizacao
                ? format(new Date(source.ultima_sincronizacao), "dd/MM/yyyy HH:mm", { locale: ptBR })
                : "Nunca"}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Vincule uma planilha do Google Drive (formato CSV) para alimentar esta meta no Painel.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Link2 className="h-3.5 w-3.5 mr-1" />
            {source ? "Alterar" : "Vincular planilha"}
          </Button>
          {source && (
            <>
              <Button size="sm" variant="outline" onClick={handleSyncNow}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Sincronizar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  toggleActive.mutate({ id: source.id, ativo: !source.ativo })
                }
              >
                {source.ativo ? "Pausar" : "Ativar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => deleteSource.mutate(source.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Vincular planilha — {def.label}</DialogTitle>
            <DialogDescription>
              Cole o link da planilha do Google Sheets em qualquer formato (/edit, /view ou /export).
              Convertemos automaticamente para CSV. A planilha precisa estar compartilhada como
              "Qualquer pessoa com o link pode visualizar".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome amigável</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={def.label}
              />
            </div>
            <div className="space-y-2">
              <Label>URL da planilha</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
                className={url && !validation.valid ? "border-destructive" : ""}
              />
              {url && !validation.valid && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validation.error}
                </p>
              )}
              {normalizedUrl && normalizedUrl !== url && (
                <p className="text-[11px] text-muted-foreground break-all">
                  → vai ler:{" "}
                  <code className="text-[11px] text-foreground/80">{normalizedUrl}</code>
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={!validation.valid || !url || preview.loading}
              >
                {preview.loading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <PlugZap className="h-3.5 w-3.5 mr-1" />
                )}
                Testar conexão
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!validation.valid || !url || !nome.trim() || linkSourceToMeta.isPending}
              >
                {linkSourceToMeta.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                )}
                Salvar vínculo
              </Button>
            </div>

            {preview.error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {preview.error}
              </div>
            )}

            {preview.headers && preview.headers.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium">
                  Conexão OK — {preview.rowCount} linhas detectadas
                </p>
                <div className="flex flex-wrap gap-1">
                  {preview.headers.map((h) => (
                    <Badge key={h} variant="secondary" className="text-[11px] font-mono">
                      {h}
                    </Badge>
                  ))}
                </div>
                {preview.sampleRows && preview.sampleRows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="text-[11px] w-full">
                      <tbody>
                        {preview.sampleRows.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-t border-border/40">
                            {row.slice(0, 6).map((cell, j) => (
                              <td key={j} className="px-2 py-1 text-muted-foreground truncate max-w-[120px]">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function MetaSheetsLinker() {
  const { sources, isLoading } = useSheetsSources();

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <CardTitle className="text-base uppercase">
            Fontes do Painel de Indicadores
          </CardTitle>
        </div>
        <CardDescription>
          Vincule uma planilha Google Sheets (formato CSV) a cada meta do painel. Cada
          visualização lerá automaticamente da planilha vinculada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {LINKABLE_METAS.map((key) => {
              const source = sources.find((s) => s.meta_key === key) ?? null;
              return <MetaSourceCard key={key} metaKey={key} source={source} />;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
