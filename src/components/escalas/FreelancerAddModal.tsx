import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useEmployees } from "@/hooks/useEmployees";
import { useUpsertSchedule } from "@/hooks/useManualSchedules";
import { useSectorJobTitles } from "@/hooks/useSectorJobTitles";
import { useJobTitles } from "@/hooks/useJobTitles";
import { useCpfLookup } from "@/hooks/useCpfLookup";
import { formatCPF } from "@/lib/formatters";
import { toast } from "sonner";

interface FreelancerAddModalProps {
  open: boolean;
  onClose: () => void;
  unitId: string;
  sectorId: string;
  date: string;
  onAdded?: (employeeId: string) => void;
}

export function FreelancerAddModal({
  open,
  onClose,
  unitId,
  sectorId,
  date,
  onAdded,
}: FreelancerAddModalProps) {
  const { data: employees = [] } = useEmployees(unitId);
  const { data: sectorJobTitles = [] } = useSectorJobTitles([sectorId]);
  const { data: allJobTitles = [] } = useJobTitles(unitId);
  const upsertSchedule = useUpsertSchedule();
  const { lookupUnifiedByCpf, isLookingUp } = useCpfLookup();

  const allowedJobTitleIds = useMemo(
    () => new Set(sectorJobTitles.map((sjt) => sjt.job_title_id)),
    [sectorJobTitles]
  );

  const allowedJobTitles = useMemo(
    () => allJobTitles.filter((jt) => allowedJobTitleIds.has(jt.id)),
    [allJobTitles, allowedJobTitleIds]
  );

  const freelancers = useMemo(
    () =>
      employees.filter(
        (e: any) =>
          e.worker_type === "freelancer" &&
          e.job_title_id &&
          allowedJobTitleIds.has(e.job_title_id)
      ),
    [employees, allowedJobTitleIds]
  );

  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [cpfValue, setCpfValue] = useState("");
  const [selectedJobTitleId, setSelectedJobTitleId] = useState("");
  const [rate, setRate] = useState("120");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:20");
  const [autoFilled, setAutoFilled] = useState(false);

  const isSaving = upsertSchedule.isPending;

  const handleCpfChange = useCallback(async (rawValue: string) => {
    const formatted = formatCPF(rawValue);
    setCpfValue(formatted);

    const clean = formatted.replace(/\D/g, "");
    if (clean.length === 11) {
      const result = await lookupUnifiedByCpf(formatted);
      if (result) {
        setNewName(result.nome_completo);
        setAutoFilled(true);
      }
    } else {
      setAutoFilled(false);
    }
  }, [lookupUnifiedByCpf]);

  async function handleSubmit() {
    const rateNum = parseFloat(rate) || 0;
    let empId = selectedId;

    if (mode === "create") {
      if (!newName.trim()) {
        toast.error("Nome é obrigatório.");
        return;
      }
      if (!selectedJobTitleId) {
        toast.error("Selecione um cargo.");
        return;
      }
      const chosenJt = allowedJobTitles.find((jt) => jt.id === selectedJobTitleId);
      const cleanCpf = cpfValue.replace(/\D/g, "");
      try {
        const { supabase } = await import("@/integrations/supabase/client");

        // Check for existing freelancer with same CPF in this unit
        if (cleanCpf) {
          const { data: existingEmp } = await supabase
            .from("employees")
            .select("id, name")
            .eq("unit_id", unitId)
            .eq("cpf", cleanCpf)
            .eq("worker_type", "freelancer")
            .eq("active", true)
            .maybeSingle();

          if (existingEmp) {
            empId = existingEmp.id;
            toast.info(`Freelancer "${existingEmp.name}" já cadastrado — reutilizando.`);
          }
        }

        // Only create if not found
        if (!empId) {
          const { data, error } = await supabase
            .from("employees")
            .insert({
              unit_id: unitId,
              name: newName.trim(),
              gender: "M",
              worker_type: "freelancer" as const,
              default_rate: rateNum,
              job_title: chosenJt?.name || "Freelancer",
              job_title_id: selectedJobTitleId,
              cpf: cleanCpf || null,
            })
            .select("id")
            .single();

          if (error) throw error;
          empId = data.id;
        }
      } catch (err: any) {
        toast.error("Erro ao criar freelancer: " + err.message);
        return;
      }
    }

    if (!empId) {
      toast.error("Selecione ou crie um freelancer.");
      return;
    }

    try {
      await upsertSchedule.mutateAsync({
        employee_id: empId,
        schedule_date: date,
        sector_id: sectorId,
        start_time: startTime,
        end_time: endTime,
        break_duration: 0,
        schedule_type: "working",
        agreed_rate: rateNum,
      });

      onAdded?.(empId);
      onClose();
      resetForm();
    } catch (err: any) {
      toast.error("Erro ao escalar: " + err.message);
    }
  }

  function resetForm() {
    setSelectedId("");
    setNewName("");
    setCpfValue("");
    setSelectedJobTitleId("");
    setRate("120");
    setStartTime("08:00");
    setEndTime("16:20");
    setMode("select");
    setAutoFilled(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>+ Freelancer</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === "select" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setMode("select")}
            >
              Existente
            </Button>
            <Button
              variant={mode === "create" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setMode("create")}
            >
              Criar Novo
            </Button>
          </div>

          {mode === "select" ? (
            <div className="space-y-1.5">
              <Label>Freelancer</Label>
              {freelancers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">
                  Nenhum freelancer com cargo compatível.{" "}
                  <button className="text-primary underline" onClick={() => setMode("create")}>
                    Criar novo
                  </button>
                </div>
              ) : (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {freelancers.map((f) => (
                      <SelectItem key={f.id} value={f.id} className="uppercase">
                        {f.name} {f.job_title ? `(${f.job_title})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <div className="relative">
                  <Input
                    value={cpfValue}
                    onChange={(e) => handleCpfChange(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                  {isLookingUp && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setAutoFilled(false); }}
                  placeholder="Nome completo"
                  className={autoFilled ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}
                />
                {autoFilled && (
                  <p className="text-xs text-green-600">Preenchido automaticamente via CPF</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Cargo *</Label>
                {allowedJobTitles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum cargo vinculado a este setor.</p>
                ) : (
                  <Select value={selectedJobTitleId} onValueChange={setSelectedJobTitleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedJobTitles.map((jt) => (
                        <SelectItem key={jt.id} value={jt.id}>
                          {jt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Valor da Diária (R$)</Label>
            <Input
              type="number"
              min={0}
              step={10}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Adicionar à Escala
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
