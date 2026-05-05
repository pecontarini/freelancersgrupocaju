import { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PARSERS,
  INDICADOR_LABELS,
  formatReferenciaLabel,
} from "@/lib/indicadores-parsers";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultMetaKey?: string;
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function UploadIndicadorModal({ open, onOpenChange, defaultMetaKey }: Props) {
  const qc = useQueryClient();
  const [metaKey, setMetaKey] = useState<string>(defaultMetaKey ?? "ranking-supervisores");
  const [referenciaMes, setReferenciaMes] = useState<string>(currentYearMonth());
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ dados: any; linhas: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const referenciaLabel = useMemo(() => formatReferenciaLabel(referenciaMes), [referenciaMes]);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setParseError(null);
  };

  const runParser = useCallback(
    async (f: File, key: string) => {
      setParsing(true);
      setParseError(null);
      setParsed(null);
      try {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: false });
        const parser = PARSERS[key];
        if (!parser) throw new Error("Parser não encontrado");
        const result = parser(wb);
        if (!result || result.linhas === 0) {
          throw new Error("Nenhum registro encontrado — confira a aba e o formato.");
        }
        setParsed(result);
      } catch (e: any) {
        setParseError(e?.message || "Formato não reconhecido");
      } finally {
        setParsing(false);
      }
    },
    [],
  );

  const handleFile = (f: File) => {
    setFile(f);
    runParser(f, metaKey);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const onMetaKeyChange = (v: string) => {
    setMetaKey(v);
    if (file) runParser(file, v);
  };

  const onSave = async () => {
    if (!parsed || !file) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        meta_key: metaKey,
        referencia_mes: referenciaMes,
        referencia_label: referenciaLabel,
        dados: parsed.dados,
        arquivo_nome: file.name,
        linhas_importadas: parsed.linhas,
        uploaded_by: userData.user?.id ?? null,
      };
      const { error } = await supabase
        .from("indicadores_snapshots" as any)
        .upsert(payload, { onConflict: "meta_key,referencia_mes" });
      if (error) throw error;

      toast.success(`Upload realizado — ${referenciaLabel} salvo com sucesso`);
      qc.invalidateQueries({ queryKey: ["indicadores_snapshot", metaKey] });
      qc.invalidateQueries({ queryKey: ["indicadores_historico", metaKey] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e?.message ?? "erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-amber-500" />
            Upload de Indicador
          </DialogTitle>
          <DialogDescription>
            Envie a planilha mensal — os dados serão extraídos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Indicador</Label>
            <Select value={metaKey} onValueChange={onMetaKeyChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INDICADOR_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mês de referência</Label>
            <Input
              type="month"
              value={referenciaMes}
              onChange={(e) => setReferenciaMes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Será salvo como: <strong>{referenciaLabel}</strong></p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("indicador-file-input")?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              dragOver ? "border-amber-500 bg-amber-500/10" : "border-border hover:border-amber-400/60",
            )}
          >
            <input
              id="indicador-file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <FileSpreadsheet className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm">
              {file ? file.name : "Arraste a planilha aqui ou clique para selecionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls</p>
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo planilha…
            </div>
          )}

          {parsed && !parsing && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {parsed.linhas} {parsed.linhas === 1 ? "registro encontrado" : "registros encontrados"}
            </div>
          )}

          {parseError && !parsing && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button
            onClick={onSave}
            disabled={!parsed || saving || parsing}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Confirmar upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
