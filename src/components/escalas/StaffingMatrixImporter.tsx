import { useState, useRef } from "react";
import { Camera, Loader2, Check, AlertTriangle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  matchedSectorId: string | null;
  createNew: boolean;
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
  }) => void;
  onAddSector: (params: { unit_id: string; name: string }) => Promise<void>;
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = a.toUpperCase().trim().replace(/\s+/g, " ");
  const nb = b.toUpperCase().trim().replace(/\s+/g, " ");
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

function findSectorMatch(name: string, sectors: Sector[]): string | null {
  for (const s of sectors) {
    if (fuzzyMatch(name, s.name)) return s.id;
  }
  return null;
}

export function StaffingMatrixImporter({ selectedUnit, sectors, onUpsert, onAddSector }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "processing" | "review">("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [applying, setApplying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
              matchedSectorId: findSectorMatch(sector.name, sectors),
              createNew: false,
              shiftType: shift.type,
              days: shift.days,
            });
          }
        }

        // Mark rows without matches for auto-creation
        rows.forEach((r) => {
          if (!r.matchedSectorId) r.createNew = true;
        });

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
      // First create any new sectors
      const newSectorNames = [...new Set(
        reviewRows.filter((r) => r.createNew && !r.matchedSectorId).map((r) => r.sectorName)
      )];

      for (const name of newSectorNames) {
        await onAddSector({ unit_id: selectedUnit, name });
      }

      // Wait a bit for sectors to be created and refetched
      if (newSectorNames.length > 0) {
        await new Promise((r) => setTimeout(r, 1500));
      }

      // Re-fetch sectors to get newly created IDs
      const { data: freshSectors } = await supabase
        .from("sectors")
        .select("*")
        .eq("unit_id", selectedUnit);

      // Now upsert all matrix entries
      for (const row of reviewRows) {
        const sectorId = row.matchedSectorId || findSectorMatch(row.sectorName, freshSectors || []);
        if (!sectorId) {
          console.warn("Setor não encontrado:", row.sectorName);
          continue;
        }

        for (const d of row.days) {
          onUpsert({
            sector_id: sectorId,
            day_of_week: d.day,
            shift_type: row.shiftType,
            required_count: d.efetivos,
            extras_count: d.extras,
          });
        }
      }

      toast.success("Matriz importada com sucesso!");
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
            {step === "upload" && "Importar Matriz via IA"}
            {step === "processing" && "Processando imagem..."}
            {step === "review" && "Revisão dos dados extraídos"}
          </DialogTitle>
        </DialogHeader>

        {/* UPLOAD STEP */}
        {step === "upload" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Envie uma foto ou imagem da tabela de efetivo mínimo (POP). A IA irá interpretar 
              setores, turnos, dias e quantidades automaticamente.
            </p>
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
            <p className="text-sm text-muted-foreground">
              Revise os dados extraídos abaixo. Você pode editar valores antes de aplicar.
            </p>

            {reviewRows.map((row, rowIdx) => (
              <div key={rowIdx} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{row.sectorName}</span>
                  <Badge variant="secondary" className="text-xs">{row.shiftType}</Badge>
                  {row.matchedSectorId ? (
                    <Badge variant="default" className="text-xs gap-1">
                      <Check className="h-3 w-3" /> Setor encontrado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1 border-orange-300 text-orange-600">
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
            ))}

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
                  "Aplicar na Matriz"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
