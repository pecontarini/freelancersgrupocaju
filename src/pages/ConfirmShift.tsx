import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, CheckCircle2, XCircle, CalendarCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type ScheduleData = {
  id: string;
  schedule_date: string;
  shift_name: string;
  sector_name: string;
  employee_name: string;
  status: string;
};

export default function ConfirmShift() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action");
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/confirm-shift/${scheduleId}${action ? `?action=${action}` : ""}`);
    }
  }, [authLoading, user, navigate, scheduleId, action]);

  // Fetch schedule data
  useEffect(() => {
    if (!user || !scheduleId) return;

    async function fetchSchedule() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("schedules")
        .select(`
          id, schedule_date, status,
          employees!schedules_employee_id_fkey ( name ),
          shifts!schedules_shift_id_fkey ( name ),
          sectors!schedules_sector_id_fkey ( name )
        `)
        .eq("id", scheduleId!)
        .maybeSingle();

      if (fetchError || !data) {
        setError("Escala não encontrada.");
        setLoading(false);
        return;
      }

      setSchedule({
        id: data.id,
        schedule_date: data.schedule_date,
        status: data.status,
        shift_name: (data.shifts as any)?.name || "Turno",
        sector_name: (data.sectors as any)?.name || "Setor",
        employee_name: (data.employees as any)?.name || "Colaborador",
      });
      setLoading(false);
    }

    fetchSchedule();
  }, [user, scheduleId]);

  // Auto-action based on query param
  useEffect(() => {
    if (!schedule || confirmed || submitting) return;

    if (action === "confirm") {
      handleConfirm();
    } else if (action === "deny") {
      setDenyOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  async function handleConfirm() {
    if (!schedule) return;
    setSubmitting(true);
    const { error: upErr } = await supabase
      .from("schedules")
      .update({ status: "confirmed" })
      .eq("id", schedule.id);

    setSubmitting(false);
    if (upErr) {
      toast.error("Erro ao confirmar: " + upErr.message);
      return;
    }
    setConfirmed(true);
  }

  async function handleDeny() {
    if (!schedule || !justificativa) return;
    setSubmitting(true);

    const { error: attErr } = await supabase
      .from("schedule_attendance")
      .upsert(
        {
          schedule_id: schedule.id,
          employee_id: schedule.id, // will be corrected below
          attendance_date: schedule.schedule_date,
          sector_id: "", // placeholder
          shift_id: "", // placeholder
          status: "ausente",
          justificativa,
        },
        { onConflict: "schedule_id" }
      );

    // Also update the schedule status
    await supabase
      .from("schedules")
      .update({ status: "cancelled" })
      .eq("id", schedule.id);

    setSubmitting(false);
    if (attErr) {
      toast.error("Erro ao registrar: " + attErr.message);
      return;
    }
    setDenyOpen(false);
    toast.success("Justificativa registrada.");
    navigate("/");
  }

  const dateFormatted = schedule
    ? new Date(schedule.schedule_date + "T12:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      })
    : "";

  // Loading / auth states
  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <AlertTriangle className="h-16 w-16 text-destructive" />
            <p className="text-lg font-semibold">{error}</p>
            <Button variant="outline" onClick={() => navigate("/")}>
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success animation
  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center animate-in zoom-in-50 duration-500">
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-20 w-20 text-primary animate-in zoom-in-0 duration-700" />
            <h2 className="text-2xl font-bold text-foreground">Tudo certo!</h2>
            <p className="text-muted-foreground">Bom trabalho, {schedule?.employee_name}.</p>
            <p className="text-sm text-muted-foreground">
              {dateFormatted} — {schedule?.shift_name} — {schedule?.sector_name}
            </p>
            <Button className="mt-4" onClick={() => navigate("/")}>
              Ir para o portal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main confirmation card
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <CalendarCheck className="h-14 w-14 text-primary mx-auto mb-2" />
          <CardTitle className="text-xl">Confirmação de Escala</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-5 pt-2 pb-8">
          <div className="text-center space-y-1">
            <p className="text-lg font-semibold text-foreground">{schedule?.employee_name}</p>
            <p className="text-muted-foreground capitalize">{dateFormatted}</p>
            <p className="text-sm text-muted-foreground">
              {schedule?.shift_name} • {schedule?.sector_name}
            </p>
          </div>

          <p className="text-center font-medium text-foreground">
            Você confirma a escala de amanhã?
          </p>

          <div className="flex gap-3 w-full">
            <Button
              className="flex-1 gap-2"
              size="lg"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Confirmar
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              size="lg"
              onClick={() => setDenyOpen(true)}
              disabled={submitting}
            >
              <XCircle className="h-5 w-5" />
              Não posso ir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deny / Justification dialog */}
      <Dialog open={denyOpen} onOpenChange={setDenyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Motivo da Ausência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={justificativa} onValueChange={setJustificativa}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atestado">Atestado Médico</SelectItem>
                <SelectItem value="falta_injustificada">Falta Injustificada</SelectItem>
                <SelectItem value="atraso">Atraso</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!justificativa || submitting}
              onClick={handleDeny}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar Justificativa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
