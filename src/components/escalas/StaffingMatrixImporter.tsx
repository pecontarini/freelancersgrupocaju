import { useState, useRef } from "react";
import { Camera, Loader2, Check, Plus, CalendarDays, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Sector } from "@/hooks/useStaffingMatrix";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface ExtractedDay {
  day: number;
  efetivos: number;
  extras: number;
}

interface ExtractedShift {
  type: string;
  days: ExtractedDay[];
}

interface ExtractedSector {
  name: string;
  shifts: ExtractedShift[];
}

interface ExtractedData {
  unit_name: string | null;
  sectors: ExtractedSector[];
}

interface ReviewRow {
  sectorName: string;
  shiftType: string;
  days: ExtractedDay[];
}

interface Props {
  selectedUnit: string;
  sectors: Sector[];
  onUpsert: (row: {
    sector_id: string;
    day_of_week: number;
    shift_type: string;
    required_count: number;
    extras_count: number;
  }) => Promise<void>;
  onAddSector: (params: { unit_id: string; name: string }) => Promise<void>;
  onClearMatrix: (sectorIds: string[]) => Promise<void>;
}

function generateMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = format(d, "yyyy-MM");
    const label = format(d, "MMMM yyyy", { locale: pt });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

export function StaffingMatrixImporter({ selectedUnit, sectors, onUpsert, onAddSector, onClearMatrix }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [applying, setApplying] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const fileRef = useRef<HTMLInputElement>(null);

  const monthOptions = generateMonthOptions();

  const reset = () => {
    setStep("upload");
    setImagePreview(null);
    setReviewRows([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      setStep("processing");

      try {
        const base64 = dataUrl.split(",")[1];
        const mimeType = file.type || "image/jpeg";

        const { data, error } = await supabase.functions.invoke("extract-staffing-matrix", {
          body: { image: base64, mimeType },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const extracted = data as ExtractedData;
        const rows: ReviewRow[] = [];

        for (const sector of extracted.sectors) {
          for (const shift of sector.shifts) {
            rows.push({
              sectorName: sector.name,
              shiftType: shift.type,
              days: shift.days,
            });
          }
        }

        setReviewRows(rows);
        setStep("review");
        if (extracted.unit_name) {
          toast.info(`Unidade detectada: ${extracted.unit_name}`);
        }
      } catch (err: any) {
        console.error(err);
        toast.error("Erro ao processar imagem: " + (err.message || "Tente novamente"));
        setStep("upload");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDayEdit = (rowIdx: number, dayIdx: number, field: "efetivos" | "extras", value: string) => {
    setReviewRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIdx) return row;
        return {
          ...row,
          days: row.days.map((d) =>
            d.day === dayIdx ? { ...d, [field]: parseInt(value) || 0 } : d
          ),
        };
      })
    );
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const uniqueSectorNames = [...new Set(reviewRows.map((r) => r.sectorName))];

      // 1. Reconcile sectors: match existing by normalized name, create missing ones
      const normalize = (s: string) => s.toUpperCase().trim();
      const existingSectors = [...sectors];
      const sectorMap = new Map<string, string>(); // normalizedName → sector_id

      for (const s of existingSectors) {
        sectorMap.set(normalize(s.name), s.id);
      }

      const sectorsToCreate = uniqueSectorNames.filter((n) => !sectorMap.has(normalize(n)));

      if (sectorsToCreate.length > 0) {
        toast.info(`Criando ${sectorsToCreate.length} novos setores...`);
        for (const name of sectorsToCreate) {
          await onAddSector({ unit_id: selectedUnit, name });
        }
        // Wait for creation to propagate
        await new Promise((r) => setTimeout(r, 1000));
      }

      // 2. Re-fetch sectors to get all IDs (existing + newly created)
      const { data: freshSectors } = await supabase
        .from("sectors")
        .select("*")
        .eq("unit_id", selectedUnit);

      if (!freshSectors || freshSectors.length === 0) {
        throw new Error("Setores não encontrados");
      }

      // Rebuild map with fresh data
      sectorMap.clear();
      for (const s of freshSectors) {
        sectorMap.set(normalize(s.name), s.id);
      }

      // 3. Clear ALL staffing_matrix entries for this unit's sectors
      const allSectorIds = freshSectors.map((s) => s.id);
      if (allSectorIds.length > 0) {
        toast.info("Limpando matriz anterior...");
        await onClearMatrix(allSectorIds);
        await new Promise((r) => setTimeout(r, 500));
      }

      // 4. Insert new matrix entries
      let savedCount = 0;
      for (const row of reviewRows) {
        const sectorId = sectorMap.get(normalize(row.sectorName))
          || freshSectors.find((s) =>
            normalize(s.name).includes(normalize(row.sectorName)) ||
            normalize(row.sectorName).includes(normalize(s.name))
          )?.id;

        if (!sectorId) {
          console.warn("Setor não encontrado:", row.sectorName);
          continue;
        }

        for (const d of row.days) {
          await onUpsert({
            sector_id: sectorId,
            day_of_week: d.day,
            shift_type: row.shiftType,
            required_count: d.efetivos,
            extras_count: d.extras,
          });
          savedCount++;
        }
      }

      toast.success(`POP importado: ${uniqueSectorNames.length} setores, ${savedCount} registros salvos (ref. ${selectedMonth})`);
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error("Erro ao aplicar: " + (err.message || "Tente novamente"));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Camera className="h-4 w-4" /> Importar via IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Importar Matriz POP via IA"}
            {step === "processing" && "Processando imagem..."}
            {step === "review" && "Revisão dos dados extraídos"}
          </DialogTitle>
        </DialogHeader>

        {/* UPLOAD STEP */}
        {step === "upload" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Envie uma foto da tabela de efetivo mínimo (POP). A IA irá interpretar 
              setores, turnos, dias e quantidades automaticamente.
            </p>

            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Mês de referência:</span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-700 dark:text-orange-300">
                <strong>Atenção:</strong> Ao importar um novo POP, todos os setores e dados 
                da matriz atual desta unidade serão substituídos pelos dados da imagem.
              </p>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Clique para selecionar ou tirar foto</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou WEBP</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* PROCESSING STEP */}
        {step === "processing" && (
          <div className="py-8 space-y-4">
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-48 mx-auto rounded-lg border object-contain"
              />
            )}
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Analisando imagem com IA...
              </p>
            </div>
          </div>
        )}

        {/* REVIEW STEP */}
        {step === "review" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Revise os dados extraídos. Setores existentes serão reutilizados, novos serão criados.
              </p>
              <Badge variant="secondary" className="gap-1">
                <CalendarDays className="h-3 w-3" />
                {monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth}
              </Badge>
            </div>

            {reviewRows.map((row, rowIdx) => {
              const normalize = (s: string) => s.toUpperCase().trim();
              const exists = sectors.some((s) => normalize(s.name) === normalize(row.sectorName));
              return (
              <div key={rowIdx} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{row.sectorName}</span>
                  <Badge variant="secondary" className="text-xs">{row.shiftType}</Badge>
                  {exists ? (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Check className="h-3 w-3" /> Já existe
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1 border-green-300 text-green-600">
                      <Plus className="h-3 w-3" /> Será criado
                    </Badge>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-20">Campo</TableHead>
                        {DAYS.map((d, i) => (
                          <TableHead key={i} className="text-center text-xs min-w-[60px]">{d}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-xs font-medium">Efetivos</TableCell>
                        {DAYS.map((_, i) => {
                          const dayData = row.days.find((d) => d.day === i);
                          return (
                            <TableCell key={i} className="p-1">
                              <Input
                                type="number"
                                min={0}
                                className="h-7 w-12 text-center text-xs mx-auto"
                                value={dayData?.efetivos ?? 0}
                                onChange={(e) => handleDayEdit(rowIdx, i, "efetivos", e.target.value)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs font-medium text-orange-600">Extras</TableCell>
                        {DAYS.map((_, i) => {
                          const dayData = row.days.find((d) => d.day === i);
                          return (
                            <TableCell key={i} className="p-1">
                              <Input
                                type="number"
                                min={0}
                                className="h-7 w-12 text-center text-xs mx-auto border-orange-300 text-orange-600"
                                value={dayData?.extras ?? 0}
                                onChange={(e) => handleDayEdit(rowIdx, i, "extras", e.target.value)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
            })}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>
                Cancelar
              </Button>
              <Button onClick={handleApply} disabled={applying}>
                {applying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" /> Aplicando...
                  </>
                ) : (
                  "Substituir e Aplicar POP"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
