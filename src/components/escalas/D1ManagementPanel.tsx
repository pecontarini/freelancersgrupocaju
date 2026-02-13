import { useState, useMemo } from "react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ClipboardCopy,
  MessageCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useD1Schedules, type D1Schedule } from "@/hooks/useD1Schedules";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserProfile } from "@/hooks/useUserProfile";

const APP_URL = window.location.origin;

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function D1ManagementPanel() {
  const { effectiveUnidadeId } = useUnidade();
  const { isAdmin, isPartner } = useUserProfile();
  const lojas = useConfigLojas();

  const [localUnitId, setLocalUnitId] = useState<string | null>(null);
  const selectedUnit = (isAdmin || isPartner) ? (localUnitId || effectiveUnidadeId) : effectiveUnidadeId;

  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(tomorrow);

  const { data: schedules = [], isLoading } = useD1Schedules(selectedUnit, selectedDate);

  // Split into 3 groups
  const { confirmed, denied, pending } = useMemo(() => {
    const confirmed: D1Schedule[] = [];
    const denied: D1Schedule[] = [];
    const pending: D1Schedule[] = [];

    for (const s of schedules) {
      if (s.confirmation_status === "confirmed") confirmed.push(s);
      else if (s.confirmation_status === "denied") denied.push(s);
      else pending.push(s);
    }

    return { confirmed, denied, pending };
  }, [schedules]);

  function navigateDate(dir: number) {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + dir);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  }

  function buildWhatsAppLink(s: D1Schedule): string {
    const phone = s.employee_phone?.replace(/\D/g, "") || "";
    const startStr = s.start_time?.slice(0, 5) || "—";
    const endStr = s.end_time?.slice(0, 5) || "—";
    const dateLabel = formatDateLabel(s.schedule_date);
    const confirmUrl = `${APP_URL}/confirm-shift/${s.id}`;

    const message = encodeURIComponent(
      `Olá ${s.employee_name}! Você tem turno ${dateLabel} (${startStr} às ${endStr}). ` +
      `Por favor, confirme sua presença neste link rápido:\n${confirmUrl}`
    );

    return `https://wa.me/${phone}?text=${message}`;
  }

  function handleCopyExecutiveSummary() {
    const unitName = lojas.options.find((l) => l.id === selectedUnit)?.nome || "—";
    const dateLabel = formatDateLabel(selectedDate);
    const total = schedules.length;

    const lines = [
      `📋 *RESUMO D-1 — ${unitName}*`,
      `📅 ${dateLabel}`,
      ``,
      `👥 Total Escalados: ${total}`,
      `✅ Confirmados: ${confirmed.length}`,
      `❌ Ausentes/Negados: ${denied.length}`,
      `⏳ Pendentes: ${pending.length}`,
    ];

    if (confirmed.length > 0) {
      lines.push(``, `*✅ CONFIRMADOS (${confirmed.length}):*`);
      confirmed.forEach((s) => {
        const time = s.start_time?.slice(0, 5) && s.end_time?.slice(0, 5)
          ? `${s.start_time!.slice(0, 5)}-${s.end_time!.slice(0, 5)}`
          : "";
        lines.push(`   • ${s.employee_name} ${s.job_title ? `(${s.job_title})` : ""} ${time} — ${s.sector_name}`);
      });
    }

    if (denied.length > 0) {
      lines.push(``, `*❌ AUSENTES (${denied.length}):*`);
      denied.forEach((s) => {
        const reason = s.denial_reason || "Sem motivo";
        lines.push(`   • ${s.employee_name} ${s.job_title ? `(${s.job_title})` : ""} — ${reason}`);
      });
    }

    if (pending.length > 0) {
      lines.push(``, `*⏳ PENDENTES (${pending.length}):*`);
      pending.forEach((s) => {
        const time = s.start_time?.slice(0, 5) && s.end_time?.slice(0, 5)
          ? `${s.start_time!.slice(0, 5)}-${s.end_time!.slice(0, 5)}`
          : "";
        lines.push(`   • ${s.employee_name} ${s.job_title ? `(${s.job_title})` : ""} ${time} — ${s.sector_name}`);
      });
    }

    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Resumo D-1 copiado! Cole no WhatsApp dos sócios.");
    });
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Gestão D-1
          </h2>
          <p className="text-muted-foreground text-sm">
            Planeamento de véspera — confirmações e cobertura.
          </p>
        </div>
        <Button
          onClick={handleCopyExecutiveSummary}
          disabled={schedules.length === 0}
          className="gap-2"
        >
          <ClipboardCopy className="h-4 w-4" />
          📋 Partilhar Resumo D-1
        </Button>
      </div>

      {/* Unit + Date selector */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          {(isAdmin || isPartner) && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Unidade</label>
              <Select value={selectedUnit || ""} onValueChange={setLocalUnitId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.options.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data</label>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[160px] h-9"
              />
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground capitalize pb-1">
            {formatDateLabel(selectedDate)}
          </p>
        </CardContent>
      </Card>

      {/* KPI Summary */}
      {selectedUnit && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total" value={schedules.length} icon={<Users className="h-5 w-5" />} color="text-foreground" />
          <KpiCard label="Confirmados" value={confirmed.length} icon={<CheckCircle2 className="h-5 w-5" />} color="text-green-600 dark:text-green-400" />
          <KpiCard label="Ausentes" value={denied.length} icon={<XCircle className="h-5 w-5" />} color="text-red-600 dark:text-red-400" />
          <KpiCard label="Pendentes" value={pending.length} icon={<Clock className="h-5 w-5" />} color="text-yellow-600 dark:text-yellow-400" />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !selectedUnit ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center text-muted-foreground">
            Selecione uma unidade para ver as escalas.
          </CardContent>
        </Card>
      ) : schedules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center text-muted-foreground">
            <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhuma escala para este dia.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pending */}
          <StatusColumn
            title="⏳ Pendentes"
            items={pending}
            color="border-yellow-400 dark:border-yellow-600"
            badgeClass="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
            showWhatsApp
            buildWhatsAppLink={buildWhatsAppLink}
          />

          {/* Denied */}
          <StatusColumn
            title="❌ Ausentes / Negados"
            items={denied}
            color="border-red-400 dark:border-red-600"
            badgeClass="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
          />

          {/* Confirmed */}
          <StatusColumn
            title="✅ Confirmados"
            items={confirmed}
            color="border-green-400 dark:border-green-600"
            badgeClass="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
          />
        </div>
      )}
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className={color}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Status Column ─── */
function StatusColumn({
  title,
  items,
  color,
  badgeClass,
  showWhatsApp,
  buildWhatsAppLink,
}: {
  title: string;
  items: D1Schedule[];
  color: string;
  badgeClass: string;
  showWhatsApp?: boolean;
  buildWhatsAppLink?: (s: D1Schedule) => string;
}) {
  return (
    <Card className={`border-t-4 ${color}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{title}</span>
          <Badge className={`${badgeClass} border-0 text-sm px-2`}>{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum</p>
        ) : (
          items.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-2.5 bg-background"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm truncate">{s.employee_name}</span>
                  {s.worker_type === "freelancer" && (
                    <Badge variant="outline" className="border-orange-400 text-orange-600 text-[9px] px-1 py-0 shrink-0">
                      FL
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  {s.job_title && <span>{s.job_title}</span>}
                  <span>•</span>
                  <span>{s.sector_name}</span>
                  {s.start_time && s.end_time && (
                    <>
                      <span>•</span>
                      <span>{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span>
                    </>
                  )}
                </div>
                {s.denial_reason && (
                  <div className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5">
                    <AlertTriangle className="h-3 w-3" />
                    Motivo: {s.denial_reason}
                  </div>
                )}
              </div>
              {showWhatsApp && buildWhatsAppLink && (
                <a
                  href={buildWhatsAppLink(s)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30 h-8"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </Button>
                </a>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
