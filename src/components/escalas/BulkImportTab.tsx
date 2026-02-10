import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { toast } from "sonner";
import { read, utils } from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAddEmployee } from "@/hooks/useEmployees";

const ACCEPT = ".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg";

const JOB_TITLES = [
  "Garçom",
  "Cozinheiro",
  "Auxiliar de Cozinha",
  "Parrillero",
  "Bartender",
  "Hostess",
  "Caixa",
  "ASG",
  "Sushiman",
  "Chefe de Salão",
  "Chefe de Cozinha",
  "Chefe de Bar",
  "Gerente",
];

export interface ParsedEmployee {
  name: string;
  job_title: string;
  phone: string;
}

interface BulkImportTabProps {
  unitId: string | null;
  onDone: () => void;
}

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// --- Column auto-mapping ---
function guessColumn(headers: string[], keywords: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseSpreadsheet(file: File): Promise<ParsedEmployee[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) {
          reject(new Error("Planilha vazia ou sem dados."));
          return;
        }

        const headers = rows[0].map(String);
        const nameIdx = guessColumn(headers, ["nome", "name", "funcionário", "colaborador"]);
        const roleIdx = guessColumn(headers, ["cargo", "função", "role", "job", "titulo"]);
        const phoneIdx = guessColumn(headers, ["telefone", "phone", "whatsapp", "celular", "contato"]);

        if (nameIdx === -1) {
          reject(new Error("Não foi possível encontrar uma coluna de 'Nome'."));
          return;
        }

        const employees: ParsedEmployee[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = String(row[nameIdx] || "").trim();
          if (!name) continue;
          employees.push({
            name,
            job_title: roleIdx !== -1 ? String(row[roleIdx] || "").trim() : "",
            phone: phoneIdx !== -1 ? normalizePhone(String(row[phoneIdx] || "")) : "",
          });
        }

        resolve(employees);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

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

  return (data.employees as any[]).map((e) => ({
    name: String(e.full_name || e.name || "").trim(),
    job_title: String(e.job_title || e.role || "").trim(),
    phone: normalizePhone(String(e.phone || "")),
  }));
}

export function BulkImportTab({ unitId, onDone }: BulkImportTabProps) {
  const addEmployee = useAddEmployee();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<ParsedEmployee[] | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFile = useCallback(async (file: File) => {
    setProcessing(true);
    setParsed(null);
    setFileName(file.name);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      let result: ParsedEmployee[];

      if (["xlsx", "xls", "csv", "pdf", "png", "jpg", "jpeg"].includes(ext)) {
        result = await extractWithAI(file);
      } else {
        toast.error("Formato não suportado.");
        return;
      }

      if (result.length === 0) {
        toast.warning("Nenhum funcionário encontrado no arquivo.");
        return;
      }

      setParsed(result);
      toast.success(`${result.length} funcionário(s) encontrado(s)!`);
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(err.message || "Erro ao processar arquivo.");
    } finally {
      setProcessing(false);
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

  const updateRow = (idx: number, field: keyof ParsedEmployee, value: string) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const removeRow = (idx: number) => {
    setParsed((prev) => prev?.filter((_, i) => i !== idx) ?? null);
  };

  const handleConfirm = async () => {
    if (!unitId || !parsed?.length) return;
    setSaving(true);

    try {
      let success = 0;
      let errors = 0;

      for (const emp of parsed) {
        try {
          await addEmployee.mutateAsync({
            unit_id: unitId,
            name: emp.name,
            gender: "M" as const,
            phone: emp.phone.replace(/\D/g, "") || undefined,
            job_title: emp.job_title || undefined,
          });
          success++;
        } catch {
          errors++;
        }
      }

      if (errors > 0) {
        toast.warning(`${success} cadastrado(s), ${errors} com erro.`);
      } else {
        toast.success(`${success} funcionário(s) cadastrado(s) com sucesso!`);
      }

      setParsed(null);
      setFileName("");
      onDone();
    } finally {
      setSaving(false);
    }
  };

  // --- Render: Preview Table ---
  if (parsed && parsed.length > 0) {
    return (
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>
            {parsed.length} funcionário(s) extraído(s) de <strong>{fileName}</strong>
          </span>
        </div>

        <div className="rounded-md border max-h-64 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.map((emp, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      value={emp.name}
                      onChange={(e) => updateRow(idx, "name", e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={JOB_TITLES.includes(emp.job_title) ? emp.job_title : "__custom__"}
                      onValueChange={(v) =>
                        updateRow(idx, "job_title", v === "__custom__" ? emp.job_title : v)
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_TITLES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">✏️ Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    {!JOB_TITLES.includes(emp.job_title) && (
                      <Input
                        value={emp.job_title}
                        onChange={(e) => updateRow(idx, "job_title", e.target.value)}
                        className="h-8 mt-1"
                        placeholder="Digite o cargo"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={emp.phone}
                      onChange={(e) =>
                        updateRow(idx, "phone", normalizePhone(e.target.value))
                      }
                      className="h-8"
                      placeholder="(XX) XXXXX-XXXX"
                      inputMode="tel"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
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

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setParsed(null);
              setFileName("");
            }}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={saving || parsed.filter((e) => e.name.trim()).length === 0}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar e Cadastrar {parsed.filter((e) => e.name.trim()).length} Funcionário(s)
          </Button>
        </div>
      </div>
    );
  }

  // --- Render: Upload Area ---
  return (
    <div className="pt-4">
      <div
        className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
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

        {processing ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processando {fileName}...</p>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="mt-4 rounded-md border border-muted bg-muted/30 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Planilhas:</strong> O sistema mapeia automaticamente colunas como
              "Nome", "Cargo" e "Telefone".
            </p>
            <p>
              <strong>PDF / Imagens:</strong> A IA extrai os dados do documento. Revise
              antes de confirmar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
