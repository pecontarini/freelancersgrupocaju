import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, CheckCircle2, ShieldAlert, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Draft = {
  id: string;
  unit_id: string;
  sector_id: string | null;
  semana_inicio: string;
  mode: "with_employees" | "empty_slots";
  modelo_folga: "5x2" | "6x1";
  status: "draft" | "published" | "discarded";
};

type Slot = {
  id: string;
  draft_id: string;
  schedule_date: string;
  dia_semana: string;
  sector_id: string | null;
  shift_label: string | null;
  start_time: string;
  end_time: string;
  break_min: number;
  shift_type: string;
  papel: string;
  tipo: "efetivo" | "extra";
  job_title_id: string | null;
  employee_id: string | null;
  agreed_rate: number;
  notes: string | null;
};

type EmployeeOption = { id: string; name: string; job_title_id: string | null };

type ValidateResult = {
  ok: boolean;
  can_publish: boolean;
  blockers: Array<{ slot_id?: string; date?: string; reason: string; message: string }>;
  warnings: Array<{ reason: string; message: string; overridable?: boolean }>;
  override_active: boolean;
  estimated_cost: number;
  month_budget: number;
  total_unbound: number;
  total_extras: number;
};

export default function EscalaDraft() {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!draftId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  async function load() {
    setLoading(true);
    const [{ data: d }, { data: sl }] = await Promise.all([
      supabase.from("schedule_drafts").select("*").eq("id", draftId!).maybeSingle(),
      supabase.from("schedule_draft_slots").select("*").eq("draft_id", draftId!).order("schedule_date").order("start_time"),
    ]);
    if (!d) {
      toast.error("Rascunho não encontrado.");
      setLoading(false);
      return;
    }
    setDraft(d as Draft);
    setSlots((sl ?? []) as Slot[]);

    // Funcionários candidatos: ativos da unidade, filtrados por sector_job_titles
    const sectorId = (d as Draft).sector_id;
    let jobTitleIds: string[] = [];
    if (sectorId) {
      const { data: sjt } = await supabase
        .from("sector_job_titles")
        .select("job_title_id")
        .eq("sector_id", sectorId);
      jobTitleIds = (sjt ?? []).map((r: any) => r.job_title_id).filter(Boolean);
    }

    let empQ = supabase
      .from("employees")
      .select("id, name, job_title_id")
      .eq("unit_id", (d as Draft).unit_id)
      .eq("active", true)
      .order("name");
    if (jobTitleIds.length > 0) {
      empQ = empQ.in("job_title_id", jobTitleIds);
    }
    const { data: emps } = await empQ;
    setEmployees((emps ?? []) as EmployeeOption[]);
    setLoading(false);
  }

  async function bindSlot(slotId: string, employeeId: string | null) {
    const { error } = await supabase
      .from("schedule_draft_slots")
      .update({ employee_id: employeeId })
      .eq("id", slotId);
    if (error) {
      toast.error("Falha ao vincular: " + error.message);
      return;
    }
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, employee_id: employeeId } : s)));
    setValidateResult(null);
  }

  async function updateRate(slotId: string, rate: number) {
    const { error } = await supabase
      .from("schedule_draft_slots")
      .update({ agreed_rate: rate })
      .eq("id", slotId);
    if (error) {
      toast.error("Falha: " + error.message);
      return;
    }
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, agreed_rate: rate } : s)));
    setValidateResult(null);
  }

  async function runValidate(overridePin: string | null = null) {
    if (!draftId) return;
    setValidating(true);
    const { data, error } = await supabase.rpc("validate_schedule_publish", {
      p_draft_id: draftId,
      p_override_pin: overridePin,
    });
    setValidating(false);
    if (error) {
      toast.error("Falha na validação: " + error.message);
      return null;
    }
    const res = data as unknown as ValidateResult;
    setValidateResult(res);
    return res;
  }

  async function publishDraft() {
    if (!draft || !draftId) return;
    const res = validateResult ?? (await runValidate());
    if (!res || !res.can_publish) {
      toast.error("Rascunho com bloqueios — corrija antes de publicar.");
      return;
    }
    setPublishing(true);
    try {
      // Pega shifts existentes da unidade para mapear
      // Materializa schedule rows a partir dos slots
      const rows = slots
        .filter((s) => s.employee_id)
        .map((s) => ({
          employee_id: s.employee_id!,
          user_id: s.employee_id!, // legacy; schedules.user_id NOT NULL
          sector_id: s.sector_id ?? draft.sector_id,
          schedule_date: s.schedule_date,
          start_time: s.start_time,
          end_time: s.end_time,
          break_duration: s.break_min,
          schedule_type: "working",
          status: "scheduled",
          agreed_rate: s.agreed_rate,
          // shift_id: precisa de um shift válido — usar o primeiro existente como fallback
        }));

      // Buscar primeiro shift como placeholder (schema legado exige NOT NULL)
      const { data: anyShift } = await supabase.from("shifts").select("id").limit(1).maybeSingle();
      if (!anyShift) {
        toast.error("Nenhum shift cadastrado na base — não é possível publicar.");
        setPublishing(false);
        return;
      }
      const rowsWithShift = rows.map((r) => ({ ...r, shift_id: anyShift.id }));

      const { error: insErr } = await supabase.from("schedules").insert(rowsWithShift);
      if (insErr) throw insErr;

      const { error: upErr } = await supabase
        .from("schedule_drafts")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", draftId);
      if (upErr) throw upErr;

      toast.success(`Escala publicada: ${rows.length} turno(s).`);
      navigate("/");
    } catch (e: any) {
      toast.error("Falha ao publicar: " + (e?.message ?? String(e)));
    }
    setPublishing(false);
  }

  const employeesByJob = useMemo(() => {
    const map = new Map<string | "any", EmployeeOption[]>();
    map.set("any", employees);
    for (const e of employees) {
      const k = e.job_title_id ?? "any";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return map;
  }, [employees]);

  const slotsByDate = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      if (!m.has(s.schedule_date)) m.set(s.schedule_date, []);
      m.get(s.schedule_date)!.push(s);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const totalSlots = slots.length;
  const boundSlots = slots.filter((s) => s.employee_id).length;
  const allBound = totalSlots > 0 && boundSlots === totalSlots;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!draft) {
    return <div className="container mx-auto p-6">Rascunho não encontrado.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Rascunho de escala</CardTitle>
              <CardDescription>
                Semana {draft.semana_inicio} · modo {draft.mode} · folga {draft.modelo_folga} · status {draft.status}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={allBound ? "default" : "secondary"}>
                {boundSlots}/{totalSlots} vinculados
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => runValidate()}
              disabled={validating}
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
              Validar
            </Button>
            <Button
              onClick={() => publishDraft()}
              disabled={!allBound || publishing || (validateResult ? !validateResult.can_publish : false)}
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Publicar
            </Button>
            {validateResult && validateResult.warnings.length > 0 && (
              <Button variant="outline" onClick={() => setPinDialogOpen(true)}>
                Override consultivo (PIN operator)
              </Button>
            )}
          </div>

          {validateResult && (
            <div className="mt-4 space-y-2">
              {validateResult.blockers.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Sem bloqueios CLT.
                </div>
              ) : (
                <div className="space-y-1">
                  {validateResult.blockers.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-destructive text-sm">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{b.message}</span>
                    </div>
                  ))}
                </div>
              )}
              {validateResult.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{w.message}</span>
                </div>
              ))}
              <div className="text-xs text-muted-foreground">
                Custo estimado R${validateResult.estimated_cost} · Orçamento mensal R${validateResult.month_budget} · Extras: {validateResult.total_extras}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {slotsByDate.map(([date, daySlots]) => (
        <Card key={date}>
          <CardHeader>
            <CardTitle className="text-base">{date} · {daySlots[0]?.dia_semana}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slot</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="text-right">Diária</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daySlots.map((s) => {
                  const candidates = s.job_title_id
                    ? (employeesByJob.get(s.job_title_id) ?? employees)
                    : employees;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.shift_label ?? "—"}</TableCell>
                      <TableCell className="text-sm">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.papel}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.tipo === "extra" ? "destructive" : "secondary"}>{s.tipo}</Badge>
                      </TableCell>
                      <TableCell>
                        <select
                          className="bg-background border rounded px-2 py-1 text-sm w-full max-w-[240px]"
                          value={s.employee_id ?? ""}
                          onChange={(e) => bindSlot(s.id, e.target.value || null)}
                        >
                          <option value="">— Não vinculado —</option>
                          {candidates.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          className="w-24 text-right"
                          value={s.agreed_rate}
                          onChange={(e) => updateRate(s.id, Number(e.target.value) || 0)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override de avisos consultivos</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o PIN do operator (mín. 4 caracteres) para silenciar avisos de orçamento e extras.
              Bloqueios CLT não podem ser overridos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN operator"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await runValidate(pin);
                setPinDialogOpen(false);
                setPin("");
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
