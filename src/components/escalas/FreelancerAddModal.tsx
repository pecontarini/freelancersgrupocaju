import { useState } from "react";
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
import { useEmployees, useAddEmployee, type Employee } from "@/hooks/useEmployees";
import { useUpsertSchedule } from "@/hooks/useManualSchedules";
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
  const freelancers = employees.filter((e: any) => e.worker_type === "freelancer");

  const addEmployee = useAddEmployee();
  const upsertSchedule = useUpsertSchedule();

  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [rate, setRate] = useState("200");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:20");

  const isSaving = addEmployee.isPending || upsertSchedule.isPending;

  async function handleSubmit() {
    const rateNum = parseFloat(rate) || 0;

    let empId = selectedId;

    if (mode === "create") {
      if (!newName.trim()) {
        toast.error("Nome é obrigatório.");
        return;
      }
      try {
        // We need to create the employee with worker_type = freelancer
        // useAddEmployee doesn't support worker_type yet, so do it directly
        const { data, error } = await (await import("@/integrations/supabase/client")).supabase
          .from("employees")
          .insert({
            unit_id: unitId,
            name: newName.trim(),
            gender: "M",
            worker_type: "freelancer",
            default_rate: rateNum,
            job_title: jobTitle || "Freelancer",
          })
          .select("id")
          .single();

        if (error) throw error;
        empId = data.id;
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
    setJobTitle("");
    setRate("200");
    setStartTime("08:00");
    setEndTime("16:20");
    setMode("select");
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
          {/* Mode toggle */}
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
                  Nenhum freelancer cadastrado.{" "}
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
                      <SelectItem key={f.id} value={f.id}>
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
                <Label>Nome *</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ex: Garçom"
                />
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
