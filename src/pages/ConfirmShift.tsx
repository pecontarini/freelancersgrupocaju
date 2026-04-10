import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Clock, MapPin, User, AlertTriangle, PartyPopper } from "lucide-react";
import cajuparLogo from "@/assets/cajupar-logo-dark.png";

interface ScheduleInfo {
  id: string;
  schedule_date: string;
  status: string;
  confirmation_status: string | null;
  confirmation_responded_at: string | null;
  employee_name: string;
  shift_name: string;
  shift_start: string;
  shift_end: string;
  sector_name: string;
}

type PageState =
  | { type: "loading" }
  | { type: "error"; code: string; message: string }
  | { type: "already_responded"; status: string; respondedAt: string; schedule: ScheduleInfo }
  | { type: "pending"; schedule: ScheduleInfo }
  | { type: "success" ; schedule: ScheduleInfo }
  | { type: "denied" };

function parseSchedule(data: any): ScheduleInfo {
  return {
    id: data.id,
    schedule_date: data.schedule_date,
    status: data.status,
    confirmation_status: data.confirmation_status,
    confirmation_responded_at: data.confirmation_responded_at,
    employee_name: (data.employees as any)?.name || "Colaborador",
    shift_name: (data.shifts as any)?.name || "Turno",
    shift_start: data.start_time?.substring(0, 5) || (data.shifts as any)?.start_time?.substring(0, 5) || "",
    shift_end: data.end_time?.substring(0, 5) || (data.shifts as any)?.end_time?.substring(0, 5) || "",
    sector_name: (data.sectors as any)?.name || "Setor",
  };
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekday = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const dayMonth = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

  if (d.toDateString() === today.toDateString()) return `Hoje, ${weekday}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Amanhã, ${weekday}`;
  return `${weekday}, ${dayMonth}`;
}

export default function ConfirmShift() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action");

  const [pageState, setPageState] = useState<PageState>({ type: "loading" });
  const [denyOpen, setDenyOpen] = useState(false);
  const [denialReason, setDenialReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const callEdge = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await supabase.functions.invoke("confirm-shift", { body });
      return res.data;
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    if (!scheduleId) {
      setPageState({ type: "error", code: "INVALID", message: "Link inválido." });
      return;
    }

    (async () => {
      const data = await callEdge({ schedule_id: scheduleId, action: "fetch" });

      if (data?.error && data?.code) {
        setPageState({ type: "error", code: data.code, message: data.error });
        return;
      }

      if (data?.error === "already_responded") {
        const sched = parseSchedule(data.schedule);
        setPageState({
          type: "already_responded",
          status: data.confirmation_status,
          respondedAt: data.confirmation_responded_at,
          schedule: sched,
        });
        return;
      }

      if (!data?.schedule) {
        setPageState({ type: "error", code: "NOT_FOUND", message: "Escala não encontrada." });
        return;
      }

      const sched = parseSchedule(data.schedule);

      // Auto-action from query param
      if (action === "confirm") {
        await handleConfirmDirect(sched);
        return;
      }
      if (action === "deny") {
        setPageState({ type: "pending", schedule: sched });
        setDenyOpen(true);
        return;
      }

      setPageState({ type: "pending", schedule: sched });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  async function handleConfirmDirect(sched: ScheduleInfo) {
    setSubmitting(true);
    const data = await callEdge({ schedule_id: sched.id, action: "confirm" });
    setSubmitting(false);
    if (data?.success) {
      setPageState({ type: "success", schedule: sched });
    } else if (data?.error === "already_responded") {
      setPageState({
        type: "already_responded",
        status: data.confirmation_status,
        respondedAt: data.confirmation_responded_at,
        schedule: sched,
      });
    } else {
      setPageState({ type: "error", code: "ERROR", message: data?.error || "Erro desconhecido." });
    }
  }

  async function handleConfirm() {
    if (pageState.type !== "pending") return;
    await handleConfirmDirect(pageState.schedule);
  }

  async function handleDeny() {
    if (pageState.type !== "pending" || !denialReason) return;
    setSubmitting(true);
    const data = await callEdge({
      schedule_id: pageState.schedule.id,
      action: "deny",
      denial_reason: denialReason,
    });
    setSubmitting(false);
    if (data?.success) {
      setDenyOpen(false);
      setPageState({ type: "denied" });
    }
  }

  // ---- RENDERS ----

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-muted flex flex-col items-center px-4 py-6">
      <img src={cajuparLogo} alt="CajuPAR" className="h-10 mb-6" />
      {children}
    </div>
  );

  if (pageState.type === "loading" || (pageState.type === "pending" && submitting && action === "confirm")) {
    return shell(
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (pageState.type === "error") {
    return shell(
      <Card className="w-full max-w-sm text-center animate-fade-in">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
          <AlertTriangle className="h-16 w-16 text-destructive" />
          <p className="text-lg font-semibold text-foreground">
            {pageState.code === "EXPIRED" ? "Link expirado ou inválido" : pageState.message}
          </p>
          <p className="text-sm text-muted-foreground">
            {pageState.code === "EXPIRED"
              ? "Esta escala já passou ou foi cancelada."
              : "Verifique o link enviado pelo WhatsApp."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (pageState.type === "already_responded") {
    const { status, respondedAt, schedule } = pageState;
    const respondedDate = respondedAt
      ? new Date(respondedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "";
    return shell(
      <Card className="w-full max-w-sm text-center animate-fade-in">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
          {status === "confirmed" ? (
            <CheckCircle2 className="h-16 w-16 text-primary" />
          ) : (
            <XCircle className="h-16 w-16 text-destructive" />
          )}
          <p className="text-lg font-semibold text-foreground">
            Você já {status === "confirmed" ? "confirmou" : "informou ausência para"} esta escala
          </p>
          <p className="text-sm text-muted-foreground">
            Respondido em {respondedDate}
          </p>
          <ScheduleDetails schedule={schedule} />
        </CardContent>
      </Card>
    );
  }

  if (pageState.type === "success") {
    return shell(
      <Card className="w-full max-w-sm text-center animate-scale-in">
        <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4">
          <div className="relative">
            <CheckCircle2 className="h-20 w-20 text-primary animate-scale-in" />
            <PartyPopper className="h-8 w-8 text-accent absolute -top-2 -right-2 animate-fade-in" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Tudo certo!</h2>
          <p className="text-muted-foreground">Bom trabalho, {pageState.schedule.employee_name}.</p>
          <ScheduleDetails schedule={pageState.schedule} />
        </CardContent>
      </Card>
    );
  }

  if (pageState.type === "denied") {
    return shell(
      <Card className="w-full max-w-sm text-center animate-fade-in">
        <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Obrigado por avisar</h2>
          <p className="text-muted-foreground">Seu gerente foi notificado.</p>
        </CardContent>
      </Card>
    );
  }

  // type === "pending"
  const { schedule } = pageState;

  return shell(
    <>
      <Card className="w-full max-w-sm animate-fade-in">
        <CardContent className="pt-6 pb-6 flex flex-col items-center gap-5">
          {/* Employee */}
          <div className="flex items-center gap-2 text-foreground">
            <User className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg font-semibold">{schedule.employee_name}</span>
          </div>

          {/* Schedule Info */}
          <div className="w-full rounded-lg bg-background border p-4 space-y-3">
            <div className="text-center">
              <p className="text-sm text-muted-foreground uppercase tracking-wide">Data</p>
              <p className="text-lg font-bold text-foreground capitalize">
                {formatDateLabel(schedule.schedule_date)}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">
                {schedule.shift_start} às {schedule.shift_end}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-base font-medium">{schedule.sector_name}</span>
            </div>
          </div>

          {/* Question */}
          <p className="text-center font-semibold text-foreground text-lg">
            Confirma sua presença?
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full">
            <Button
              size="lg"
              className="w-full h-14 text-base gap-2"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-6 w-6" />
              )}
              CONFIRMAR PRESENÇA
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 text-base gap-2 border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setDenyOpen(true)}
              disabled={submitting}
            >
              <XCircle className="h-5 w-5" />
              Informar Ausência
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Denial Modal */}
      <Dialog open={denyOpen} onOpenChange={setDenyOpen}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Motivo da Ausência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={denialReason} onValueChange={setDenialReason}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="doenca">Doença</SelectItem>
                <SelectItem value="transporte">Transporte</SelectItem>
                <SelectItem value="pessoal">Pessoal</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="w-full h-12"
              disabled={!denialReason || submitting}
              onClick={handleDeny}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ScheduleDetails({ schedule }: { schedule: ScheduleInfo }) {
  return (
    <div className="text-sm text-muted-foreground space-y-1 mt-2">
      <p className="capitalize">{formatDateLabel(schedule.schedule_date)}</p>
      <p>
        {schedule.shift_start} às {schedule.shift_end} • {schedule.sector_name}
      </p>
    </div>
  );
}
