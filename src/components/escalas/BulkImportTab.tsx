import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Brain,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAddEmployee } from "@/hooks/useEmployees";
import { useJobTitles, useUpsertJobTitle } from "@/hooks/useJobTitles";
import * as XLSX from "xlsx";

const ACCEPT = ".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg";

const DEFAULT_JOB_TITLES = [
  "Garçom", "Cozinheiro", "Auxiliar de Cozinha", "Parrillero",
  "Bartender", "Hostess", "Caixa", "ASG", "Sushiman",
  "Chefe de Salão", "Chefe de Cozinha", "Chefe de Bar", "Gerente",
];

export interface ParsedEmployee {
  name: string;
  job_title: string;
  phone: string;
  confidence: {
    name: boolean;
    job_title: boolean;
    phone: boolean;
  };
}

interface BulkImportTabProps {
  unitId: string | null;
  onDone: () => void;
  /** If true, show a unit selector (for admin/operator users) */
  showUnitSelector?: boolean;
  /** All available units for the selector */
  availableUnits?: { id: string; nome: string }[];
}

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function assessConfidence(emp: { name: string; job_title: string; phone: string }): ParsedEmployee["confidence"] {
  const phoneDigits = (emp.phone || "").replace(/\D/g, "");
  return {
    name: emp.name.trim().length >= 3 && /\s/.test(emp.name.trim()),
    job_title: !!emp.job_title && emp.job_title !== "Staff",
    phone: phoneDigits.length === 10 || phoneDigits.length === 11,
  };
}

// --- Local SheetJS parsing for Excel/CSV ---
const NAME_COLS = ["nome", "name", "nome_completo", "full_name", "funcionario", "colaborador", "nome completo"];
const ROLE_COLS = ["cargo", "role", "funcao", "função", "job_title", "job", "profissão", "profissao"];
const PHONE_COLS = ["telefone", "phone", "celular", "whatsapp", "fone", "tel"];

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => (h || "").toString().toLowerCase().trim());
  for (const c of candidates) {
    const idx = normalized.indexOf(c);
    if (idx >= 0) return idx;
  }
  // Fuzzy: check if header includes candidate
  for (const c of candidates) {
    const idx = normalized.findIndex((h) => h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseSpreadsheetLocally(file: File): Promise<ParsedEmployee[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (rows.length < 2) {
          reject(new Error("Planilha vazia ou sem dados suficientes."));
          return;
        }

        const headers = rows[0].map((h) => String(h));
        const nameIdx = findColumn(headers, NAME_COLS);
        const roleIdx = findColumn(headers, ROLE_COLS);
        const phoneIdx = findColumn(headers, PHONE_COLS);

        if (nameIdx === -1) {
          reject(new Error("Coluna de nome não encontrada. Use: Nome, Funcionário ou Colaborador."));
          return;
        }

        const employees: ParsedEmployee[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = String(row[nameIdx] || "").trim();
          if (!name || name.length < 2) continue;

          const job_title = roleIdx >= 0 ? String(row[roleIdx] || "").trim() : "";
          const phone = phoneIdx >= 0 ? normalizePhone(String(row[phoneIdx] || "")) : "";

          employees.push({
            name,
            job_title,
            phone,
            confidence: assessConfidence({ name, job_title, phone }),
          });
        }

        resolve(employees);
      } catch (err) {
        reject(new Error("Erro ao ler planilha: " + (err as Error).message));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

// --- AI extraction for PDF/Image ---
async function extractWithAI(file: File): Promise<ParsedEmployee[]> {
  const formData = new FormData();
  formData.append("file", file);

  const { data, error } = await supabase.functions.invoke("extract-team-data", {
    body: formData,
  });

  if (error) throw new Error(error.message || "Erro ao processar arquivo.");
  if (!data?.employees || !Array.isArray(data.employees)) {
    throw new Error("A IA não retornou uma lista válida.");
  }

  return (data.employees as any[]).map((e) => {
    const name = String(e.full_name || e.name || "").trim();
    const job_title = String(e.job_title || e.role || "").trim();
    const phone = normalizePhone(String(e.phone || ""));
    return {
      name,
      job_title,
      phone,
      confidence: assessConfidence({ name, job_title, phone }),
    };
  });
}

const AI_LOADER_STEPS = [
  "Lendo documento...",
  "Analisando estrutura da tabela...",
  "Identificando funcionários...",
  "Normalizando dados...",
];

function AILoader({ fileName }: { fileName: string }) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((prev) => (prev < AI_LOADER_STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const progress = ((stepIdx + 1) / AI_LOADER_STEPS.length) * 90;

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="relative">
        <Brain className="h-12 w-12 text-primary animate-pulse" />
        <Loader2 className="h-5 w-5 animate-spin text-primary absolute -bottom-1 -right-1" />
      </div>
      <div className="text-center space-y-1.5 w-full max-w-xs">
        <p className="text-sm font-medium text-foreground">
          Analisando <span className="text-primary">{fileName}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {AI_LOADER_STEPS[stepIdx]}
        </p>
        <Progress value={progress} className="h-1.5 mt-2" />
      </div>
      <p className="text-[11px] text-muted-foreground/60">
        A IA está lendo a tabela. Isso pode levar alguns segundos.
      </p>
    </div>
  );
}

function ConfidenceInput({
  value,
  confident,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  confident: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "tel" | "text";
}) {
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 pr-7 ${!confident ? "border-yellow-400 bg-yellow-400/5 focus-visible:ring-yellow-400" : ""}`}
        placeholder={placeholder}
        inputMode={inputMode}
      />
      {!confident && (
        <AlertTriangle className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-yellow-500" />
      )}
    </div>
  );
}

export function BulkImportTab({ unitId: propUnitId, onDone, showUnitSelector, availableUnits }: BulkImportTabProps) {
  const [overrideUnitId, setOverrideUnitId] = useState<string | null>(null);
  const unitId = overrideUnitId || propUnitId;

  const addEmployee = useAddEmployee();
  const upsertJobTitle = useUpsertJobTitle();
  const { data: dbJobTitles = [] } = useJobTitles(unitId);
  const fileRef = useRef<HTMLInputElement>(null);

  // Merge DB titles with defaults
  const allJobTitleNames = Array.from(new Set([
    ...dbJobTitles.map((jt) => jt.name),
    ...DEFAULT_JOB_TITLES,
  ])).sort();

  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<ParsedEmployee[] | null>(null);
  const [fileName, setFileName] = useState("");

  const [processingMode, setProcessingMode] = useState<"local" | "ai" | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setProcessing(true);
    setParsed(null);
    setFileName(file.name);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";

      if (!["xlsx", "xls", "csv", "pdf", "png", "jpg", "jpeg"].includes(ext)) {
        toast.error("Formato não suportado.");
        return;
      }

      let result: ParsedEmployee[];

      // Excel/CSV: try local parsing first, fallback to AI for complex layouts
      if (["xlsx", "xls", "csv"].includes(ext)) {
        setProcessingMode("local");
        try {
          result = await parseSpreadsheetLocally(file);
        } catch (localErr) {
          console.log("Local parse failed, falling back to AI:", (localErr as Error).message);
          setProcessingMode("ai");
          result = await extractWithAI(file);
        }
      } else {
        // PDF/Image: send to AI edge function
        setProcessingMode("ai");
        result = await extractWithAI(file);
      }

      if (result.length === 0) {
        toast.warning("Nenhum funcionário encontrado no arquivo.");
        return;
      }

      setParsed(result);

      const lowConfCount = result.filter(
        (e) => !e.confidence.name || !e.confidence.job_title || !e.confidence.phone
      ).length;

      if (lowConfCount > 0) {
        toast.info(`${result.length} extraído(s) — ${lowConfCount} campo(s) precisam de revisão`, {
          icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
        });
      } else {
        toast.success(`${result.length} funcionário(s) extraído(s) com alta confiança!`);
      }
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(err.message || "Erro ao processar arquivo.");
    } finally {
      setProcessing(false);
      setProcessingMode(null);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const updateRow = (idx: number, field: keyof Omit<ParsedEmployee, "confidence">, value: string) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const updated = { ...next[idx], [field]: value };
      updated.confidence = assessConfidence(updated);
      next[idx] = updated;
      return next;
    });
  };

  const removeRow = (idx: number) => {
    setParsed((prev) => prev?.filter((_, i) => i !== idx) ?? null);
  };

  const handleConfirm = async () => {
    if (!unitId) {
      toast.error("Selecione uma unidade antes de importar.");
      return;
    }
    if (!parsed?.length) return;
    const validRows = parsed.filter((e) => e.name.trim());
    if (validRows.length === 0) {
      toast.error("Nenhum funcionário válido para importar.");
      return;
    }

    setSaving(true);

    try {
      let success = 0;
      let errors = 0;

      for (const emp of validRows) {
        try {
          // Resolve job_title_id
          let jobTitleId: string | undefined;
          if (emp.job_title && unitId) {
            try {
              const jt = await upsertJobTitle.mutateAsync({ name: emp.job_title, unit_id: unitId });
              jobTitleId = jt.id;
            } catch { /* continue without */ }
          }

          await addEmployee.mutateAsync({
            unit_id: unitId,
            name: emp.name.trim(),
            gender: "M" as const,
            phone: emp.phone.replace(/\D/g, "") || undefined,
            job_title: emp.job_title || undefined,
            job_title_id: jobTitleId,
          });
          success++;
        } catch {
          errors++;
        }
      }

      if (errors > 0) {
        toast.warning(`${success} cadastrado(s), ${errors} com erro.`);
      } else {
        toast.success(`Equipe cadastrada com sucesso! ${success} funcionário(s).`);
      }

      setParsed(null);
      setFileName("");
      onDone();
    } finally {
      setSaving(false);
    }
  };

  // --- Render: Processing ---
  if (processing) {
    return (
      <div className="pt-4">
        <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
          {processingMode === "ai" ? (
            <AILoader fileName={fileName} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              <Zap className="h-10 w-10 text-primary" />
              <p className="text-sm font-medium text-foreground">
                Processando <span className="text-primary">{fileName}</span> localmente...
              </p>
              <Progress value={60} className="h-1.5 w-48" />
              <p className="text-[11px] text-muted-foreground/60">
                Leitura direta via SheetJS — sem custo de IA
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Render: Review Table ---
  if (parsed && parsed.length > 0) {
    const validCount = parsed.filter((e) => e.name.trim()).length;
    const lowConfCount = parsed.filter(
      (e) => !e.confidence.name || !e.confidence.job_title || !e.confidence.phone
    ).length;

    return (
      <div className="space-y-3 pt-2">
        {/* Summary header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-foreground font-medium">
              {parsed.length} funcionário(s) de <span className="text-primary">{fileName}</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => { setParsed(null); setFileName(""); }}
          >
            Novo arquivo
          </Button>
        </div>

        {/* Confidence warning */}
        {lowConfCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {lowConfCount} campo(s) com baixa confiança (borda amarela). Revise antes de importar.
            </span>
          </div>
        )}

        {/* Review table */}
        <div className="rounded-md border max-h-72 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Nome</TableHead>
                <TableHead className="w-[30%]">Cargo</TableHead>
                <TableHead className="w-[25%]">Telefone</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.map((emp, idx) => (
                <TableRow key={idx}>
                  <TableCell className="py-1.5">
                    <ConfidenceInput
                      value={emp.name}
                      confident={emp.confidence.name}
                      onChange={(v) => updateRow(idx, "name", v)}
                      placeholder="Nome completo"
                    />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className={!emp.confidence.job_title ? "ring-1 ring-yellow-400 rounded-md" : ""}>
                      <Select
                        value={allJobTitleNames.includes(emp.job_title) ? emp.job_title : "__custom__"}
                        onValueChange={(v) =>
                          updateRow(idx, "job_title", v === "__custom__" ? emp.job_title : v)
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          {allJobTitleNames.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">✏️ Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {!allJobTitleNames.includes(emp.job_title) && emp.job_title !== "" && (
                      <Input
                        value={emp.job_title}
                        onChange={(e) => updateRow(idx, "job_title", e.target.value)}
                        className="h-7 mt-1 text-xs"
                        placeholder="Digite o cargo"
                      />
                    )}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <ConfidenceInput
                      value={emp.phone}
                      confident={emp.confidence.phone}
                      onChange={(v) => updateRow(idx, "phone", normalizePhone(v))}
                      placeholder="(XX) XXXXX-XXXX"
                      inputMode="tel"
                    />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeRow(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Action bar */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { setParsed(null); setFileName(""); }}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleConfirm}
            disabled={saving || validCount === 0}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Importar {validCount} Funcionário(s)
          </Button>
        </div>
      </div>
    );
  }

  // --- Render: Upload Area ---
  const uploadDisabled = !unitId;

  return (
    <div className="pt-4 space-y-4">
      {/* Unit selector for admin/partner */}
      {showUnitSelector && availableUnits && availableUnits.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Unidade de destino *
          </label>
          <Select value={overrideUnitId || ""} onValueChange={setOverrideUnitId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div
        className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
          uploadDisabled
            ? "border-muted/50 bg-muted/20 opacity-60 cursor-not-allowed"
            : dragActive
            ? "border-primary bg-primary/5 cursor-pointer"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 cursor-pointer"
        }`}
        onDragOver={(e) => { e.preventDefault(); if (!uploadDisabled) setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { if (!uploadDisabled) onDrop(e); else e.preventDefault(); }}
        onClick={() => { if (!uploadDisabled) fileRef.current?.click(); }}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChange}
          className="hidden"
        />
        <div className="flex gap-2 text-muted-foreground">
          <Upload className="h-8 w-8" />
          <FileSpreadsheet className="h-8 w-8" />
          <ImageIcon className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Arraste sua planilha ou uma foto da lista de funcionários
        </p>
        <p className="text-xs text-muted-foreground">
          Formatos aceitos: Excel, CSV, PDF, PNG, JPG
        </p>
        <Button variant="outline" size="sm" className="mt-1">
          Selecionar Arquivo
        </Button>
      </div>

      <div className="mt-4 rounded-md border border-muted bg-muted/30 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Excel/CSV:</strong> Leitura local instantânea via SheetJS — busca colunas de nome, cargo e telefone automaticamente.
            </p>
            <p>
              <strong>PDF/Imagem:</strong> Processamento via IA para extrair dados de documentos visuais.
            </p>
            <p>
              Campos com baixa confiança serão destacados em <span className="text-yellow-600 dark:text-yellow-400 font-medium">amarelo</span> para revisão antes da importação.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
