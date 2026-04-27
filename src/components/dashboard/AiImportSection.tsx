import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { ImportJob, useImportJobs } from "@/hooks/useImportJobs";
import { ImportPreviewModal } from "./ImportPreviewModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  extracting: { label: "Extraindo", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30", icon: Loader2 },
  preview_ready: { label: "Aguardando", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30", icon: Eye },
  confirmed: { label: "Importado", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", icon: CheckCircle2 },
  failed: { label: "Falhou", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-muted-foreground/30", icon: XCircle },
};

const fileIcon = (mime: string | null) => {
  if (!mime) return FileText;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  if (mime.includes("image")) return ImageIcon;
  return FileText;
};

export function AiImportSection() {
  const { list, extract } = useImportJobs();
  const [hintDestino, setHintDestino] = useState<string>("auto");
  const [previewJob, setPreviewJob] = useState<ImportJob | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    await extract.mutateAsync({
      file,
      hintDestino: hintDestino === "auto" ? undefined : (hintDestino as any),
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const openPreview = (job: ImportJob) => {
    setPreviewJob(job);
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Motor de Importação IA
          </CardTitle>
          <CardDescription>
            Envie planilhas (XLSX, CSV), PDFs ou imagens — a IA extrai e mapeia
            automaticamente para Performance, Lançamentos Diários ou Reclamações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Destino:</span>
            <Select value={hintDestino} onValueChange={setHintDestino}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Detectar automaticamente</SelectItem>
                <SelectItem value="store_performance">Performance Mensal (inclui Tempo de Comanda)</SelectItem>
                <SelectItem value="store_performance_entries">Lançamentos Diários (inclui Tempo de Comanda)</SelectItem>
                <SelectItem value="reclamacoes">Reclamações Individuais</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground -mt-1">
            💡 Para metas de <strong>Tempo de Comanda / Tempo de Prato</strong> dos chefes, suba a planilha do KDS no
            mesmo botão abaixo. A IA detecta colunas tipo "Tempo Médio", "mm:ss", etc., e popula
            automaticamente <code>tempo_prato_avg</code>.
          </p>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              "border-primary/30 hover:border-primary hover:bg-primary/5",
              extract.isPending && "opacity-60 pointer-events-none"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            {extract.isPending ? (
              <div className="flex flex-col items-center gap-2 text-primary">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="font-medium">IA processando o arquivo...</p>
                <p className="text-xs text-muted-foreground">
                  Pode levar alguns segundos
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-primary/60" />
                <p className="font-medium">
                  Arraste um arquivo aqui ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  XLSX, CSV, PDF ou imagem (até 20 MB)
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Importações</CardTitle>
          <CardDescription>Últimas 50 execuções (manuais e automáticas)</CardDescription>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !list.data || list.data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma importação registrada ainda
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo / Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead className="text-right">Confiança</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((job) => {
                  const Icon = fileIcon(job.file_mime);
                  const status = STATUS_BADGE[job.status] || STATUS_BADGE.failed;
                  const StatusIcon = status.icon;
                  const conf = job.ai_confianca ? Math.round(job.ai_confianca * 100) : null;
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="text-xs font-medium truncate max-w-[200px]">
                              {job.file_name || job.origem}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {job.origem.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1 text-xs", status.cls)}>
                          <StatusIcon
                            className={cn("h-3 w-3", job.status === "extracting" && "animate-spin")}
                          />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {job.status === "confirmed"
                          ? `${job.linhas_importadas}`
                          : `${job.linhas_validas}/${job.total_linhas}`}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {conf !== null ? `${conf}%` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(job.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {job.status === "preview_ready" && (
                          <Button size="sm" variant="default" onClick={() => openPreview(job)}>
                            Revisar
                          </Button>
                        )}
                        {(job.status === "confirmed" || job.status === "failed") && (
                          <Button size="sm" variant="ghost" onClick={() => openPreview(job)}>
                            Ver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ImportPreviewModal
        job={previewJob}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
