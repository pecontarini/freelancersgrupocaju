import { useState, useRef, useCallback } from "react";
import { DatabaseZap, Play, FileSearch, CheckCircle, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useConfigLojas } from "@/hooks/useConfigOptions";

interface LogEntry {
  audit_id: string;
  file_name: string;
  status: string;
  old_score: number;
  new_score: number | null;
  checklist_type: string | null;
  author: string | null;
  message: string;
}

export function LegacySyncPanel() {
  const { toast } = useToast();
  const { options: lojas } = useConfigLojas();

  const [selectedLojaId, setSelectedLojaId] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [dryRun, setDryRun] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<{ total: number; updated: number; errors: number; unchanged: number } | null>(null);
  const abortRef = useRef(false);

  const months = (() => {
    const now = new Date();
    const items: { value: string; label: string }[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      items.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return items;
  })();

  const handleScan = useCallback(async (forceDryRun?: boolean) => {
    const isDry = forceDryRun !== undefined ? forceDryRun : dryRun;
    setIsProcessing(true);
    setProgress(5);
    setLogs([]);
    setSummary(null);
    abortRef.current = false;

    try {
      // Step 1: List all audits with PDFs
      setStatusText("Listando auditorias com PDF...");
      const listBody: Record<string, unknown> = { action: "list" };
      if (selectedLojaId !== "all") listBody.loja_id = selectedLojaId;
      if (selectedMonth !== "all") listBody.month_year = selectedMonth;

      const { data: listData, error: listError } = await supabase.functions.invoke("scan-storage-fix-scores", { body: listBody });
      if (listError) throw new Error(listError.message);
      if (!listData.success) throw new Error(listData.error);

      const audits = listData.audits as Array<{ id: string; loja_id: string; audit_date: string; global_score: number; pdf_url: string }>;
      
      if (audits.length === 0) {
        toast({ title: "Nenhum PDF encontrado", description: "Não há auditorias com PDF anexado para os filtros selecionados." });
        setIsProcessing(false);
        return;
      }

      setStatusText(`${audits.length} PDFs encontrados. Processando...`);
      setProgress(10);

      let updated = 0;
      let errors = 0;
      let unchanged = 0;

      // Step 2: Process each PDF one at a time
      for (let i = 0; i < audits.length; i++) {
        if (abortRef.current) break;

        const audit = audits[i];
        const fileName = audit.pdf_url.split("/").pop() || "unknown.pdf";
        setStatusText(`Lendo ${fileName} (${i + 1}/${audits.length})...`);
        setProgress(10 + Math.round((i / audits.length) * 80));

        try {
          const { data, error } = await supabase.functions.invoke("scan-storage-fix-scores", {
            body: {
              action: "process_single",
              audit_id: audit.id,
              pdf_url: audit.pdf_url,
              old_score: audit.global_score,
              dry_run: isDry,
            },
          });

          if (error) throw new Error(error.message);
          if (!data.success) throw new Error(data.error);

          const logEntry: LogEntry = {
            audit_id: audit.id,
            file_name: data.file_name,
            status: data.status,
            old_score: data.old_score ?? audit.global_score,
            new_score: data.new_score ?? null,
            checklist_type: data.checklist_type ?? null,
            author: data.author ?? null,
            message: data.message,
          };

          setLogs((prev) => [...prev, logEntry]);

          if (data.status === "updated" || data.status === "would_update") updated++;
          else if (data.status === "error" || data.status === "skipped") errors++;
          else unchanged++;

        } catch (err) {
          errors++;
          setLogs((prev) => [
            ...prev,
            {
              audit_id: audit.id,
              file_name: fileName,
              status: "error",
              old_score: audit.global_score,
              new_score: null,
              checklist_type: null,
              author: null,
              message: err instanceof Error ? err.message : String(err),
            },
          ]);
        }
      }

      // Step 3: Trigger recalculation if needed
      if (!isDry && updated > 0) {
        setStatusText("Recalculando scores de liderança...");
        setProgress(92);

        const recalcBody: Record<string, unknown> = { action: "recalculate" };
        if (selectedLojaId !== "all") recalcBody.loja_id = selectedLojaId;
        if (selectedMonth !== "all") recalcBody.month_year = selectedMonth;

        await supabase.functions.invoke("scan-storage-fix-scores", { body: recalcBody });
      }

      setSummary({ total: audits.length, updated, errors, unchanged });
      setProgress(100);
      setStatusText("Concluído!");

      toast({
        title: isDry ? "Simulação concluída" : "Sincronização concluída",
        description: `${audits.length} PDFs analisados, ${updated} ${isDry ? "pendentes" : "atualizados"}, ${errors} erros.`,
      });

    } catch (err) {
      toast({
        title: "Erro na sincronização",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [dryRun, selectedLojaId, selectedMonth, toast]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "updated": return <CheckCircle className="h-3.5 w-3.5 text-primary" />;
      case "would_update": return <DatabaseZap className="h-3.5 w-3.5 text-accent-foreground" />;
      case "unchanged": return <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />;
      case "error": return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
      default: return <FileSearch className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "updated": return <Badge variant="default">Atualizado</Badge>;
      case "would_update": return <Badge variant="secondary">Pendente</Badge>;
      case "unchanged": return <Badge variant="outline">Igual</Badge>;
      case "error": return <Badge variant="destructive">Erro</Badge>;
      case "skipped": return <Badge variant="outline">Ignorado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base uppercase">
          <DatabaseZap className="h-5 w-5 text-primary" />
          Sincronização de Legado (PDF Miner)
        </CardTitle>
        <CardDescription>
          Lê os PDFs já anexados às auditorias, extrai as notas reais via IA e corrige o banco de dados automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Unidade</Label>
            <Select value={selectedLojaId} onValueChange={setSelectedLojaId}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {lojas.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Mês</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Modo</Label>
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-background">
              <Switch checked={dryRun} onCheckedChange={setDryRun} id="dry-run" />
              <Label htmlFor="dry-run" className="text-sm cursor-pointer">
                {dryRun ? "Simulação" : "Aplicar"}
              </Label>
            </div>
          </div>
        </div>

        {/* Action button */}
        <Button
          onClick={() => handleScan()}
          disabled={isProcessing}
          className="w-full"
          variant={dryRun ? "outline" : "default"}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {statusText}
            </>
          ) : (
            <>
              {dryRun ? <FileSearch className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {dryRun ? "Simular Leitura de PDFs" : "Ler PDFs e Corrigir Notas"}
            </>
          )}
        </Button>

        {/* Progress bar */}
        {isProcessing && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">{statusText}</p>
          </div>
        )}

        {/* Results */}
        {(summary || logs.length > 0) && (
          <div className="space-y-3">
            {/* Summary */}
            {summary && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-2xl font-bold">{summary.total}</p>
                    <p className="text-xs text-muted-foreground">PDFs</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{summary.updated}</p>
                    <p className="text-xs text-muted-foreground">{dryRun ? "Pendentes" : "Atualizados"}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-2xl font-bold">{summary.unchanged}</p>
                    <p className="text-xs text-muted-foreground">Iguais</p>
                  </div>
                  <div className="rounded-lg bg-destructive/10 p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{summary.errors}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                </div>

                {dryRun && logs.some((l) => l.status === "would_update") && (
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => handleScan(false)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Aplicar {logs.filter((l) => l.status === "would_update").length} Correções
                  </Button>
                )}
              </>
            )}

            {/* Log entries */}
            <ScrollArea className="h-64 rounded-lg border">
              <div className="p-2 space-y-1">
                {logs.map((log, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-xs p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    {getStatusIcon(log.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono truncate max-w-[200px]">{log.file_name}</span>
                        {getStatusBadge(log.status)}
                        {log.checklist_type && (
                          <Badge variant="outline" className="text-[10px]">{log.checklist_type}</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5">{log.message}</p>
                    </div>
                    {log.new_score !== null && (
                      <span className="font-mono text-xs whitespace-nowrap">
                        {log.old_score.toFixed(1)} → <span className="font-bold">{log.new_score.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
