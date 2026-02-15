import { useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MessageCircle,
  AlertTriangle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { D1Schedule } from "@/hooks/useD1Schedules";

const SECTOR_ICONS: Record<string, string> = {
  cozinha: "🔪",
  bar: "🍹",
  salão: "🍽️",
  salao: "🍽️",
  admin: "📋",
  limpeza: "🧹",
  copa: "☕",
  recepção: "🛎️",
  recepcao: "🛎️",
};

function getSectorIcon(sectorName: string): string {
  const key = sectorName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [k, v] of Object.entries(SECTOR_ICONS)) {
    if (key.includes(k)) return v;
  }
  return "📍";
}

function sortByUrgency(items: D1Schedule[]): D1Schedule[] {
  const order = (s: D1Schedule) => {
    if (!s.confirmation_status || s.confirmation_status === "pending") return 0;
    if (s.confirmation_status === "denied") return 1;
    return 2; // confirmed
  };
  return [...items].sort((a, b) => order(a) - order(b));
}

interface SectorGroup {
  sectorId: string;
  sectorName: string;
  items: D1Schedule[];
  confirmed: number;
  denied: number;
  pending: number;
}

export function groupBySector(schedules: D1Schedule[]): SectorGroup[] {
  const map = new Map<string, SectorGroup>();

  for (const s of schedules) {
    let group = map.get(s.sector_id);
    if (!group) {
      group = {
        sectorId: s.sector_id,
        sectorName: s.sector_name,
        items: [],
        confirmed: 0,
        denied: 0,
        pending: 0,
      };
      map.set(s.sector_id, group);
    }
    group.items.push(s);
    if (s.confirmation_status === "confirmed") group.confirmed++;
    else if (s.confirmation_status === "denied") group.denied++;
    else group.pending++;
  }

  // Sort sectors: those with issues first
  return Array.from(map.values()).sort((a, b) => {
    const aRisk = a.pending + a.denied;
    const bRisk = b.pending + b.denied;
    if (aRisk !== bRisk) return bRisk - aRisk;
    return a.sectorName.localeCompare(b.sectorName);
  });
}

interface D1SectorAccordionProps {
  sectors: SectorGroup[];
  dateLabel: string;
  buildWhatsAppLink: (s: D1Schedule) => string;
}

export function D1SectorAccordion({ sectors, dateLabel, buildWhatsAppLink }: D1SectorAccordionProps) {
  // Open sectors with pending/denied by default
  const defaultOpen = useMemo(
    () => sectors.filter((s) => s.pending > 0 || s.denied > 0).map((s) => s.sectorId),
    [sectors]
  );

  return (
    <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
      {sectors.map((sector) => {
        const total = sector.items.length;
        const allConfirmed = sector.confirmed === total && total > 0;
        const hasRisk = sector.denied > 0 || sector.pending > 0;
        const sorted = sortByUrgency(sector.items);

        const borderColor = allConfirmed
          ? "border-l-green-500"
          : hasRisk
          ? "border-l-destructive"
          : "border-l-muted";

        return (
          <AccordionItem
            key={sector.sectorId}
            value={sector.sectorId}
            className={`rounded-lg border border-l-4 ${borderColor} overflow-hidden bg-card`}
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline gap-3">
              <div className="flex items-center justify-between w-full pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{getSectorIcon(sector.sectorName)}</span>
                  <span className="font-semibold text-sm uppercase tracking-wide truncate">
                    {sector.sectorName}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sector.pending > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5">
                      <Clock className="h-3 w-3" />
                      {sector.pending}
                    </Badge>
                  )}
                  {sector.denied > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-0">
                      <XCircle className="h-3 w-3" />
                      {sector.denied}
                    </Badge>
                  )}
                  <Badge
                    className={`text-[10px] px-1.5 py-0 border-0 gap-0.5 ${
                      allConfirmed
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {sector.confirmed}/{total}
                  </Badge>
                  <SectorWhatsAppButton sector={sector} dateLabel={dateLabel} />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <div className="space-y-2">
                {sorted.map((s) => (
                  <ScheduleCard key={s.id} schedule={s} buildWhatsAppLink={buildWhatsAppLink} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

/* ─── Sector WhatsApp Button ─── */
function SectorWhatsAppButton({ sector, dateLabel }: { sector: SectorGroup; dateLabel: string }) {
  if (sector.pending === 0 && sector.denied === 0) return null;

  const missing = sector.pending + sector.denied;
  const message = encodeURIComponent(
    `Pessoal da ${sector.sectorName}, favor confirmar a escala de amanhã (${dateLabel}) no app! ` +
    `Faltam ${missing} pessoa${missing > 1 ? "s" : ""}.`
  );
  const url = `https://wa.me/?text=${message}`;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 gap-1 text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30 text-[10px]"
      >
        <MessageCircle className="h-3 w-3" />
        Cobrar
      </Button>
    </a>
  );
}

/* ─── Schedule Card ─── */
function ScheduleCard({
  schedule: s,
  buildWhatsAppLink,
}: {
  schedule: D1Schedule;
  buildWhatsAppLink: (s: D1Schedule) => string;
}) {
  const isPending = !s.confirmation_status || s.confirmation_status === "pending";
  const isDenied = s.confirmation_status === "denied";
  const isConfirmed = s.confirmation_status === "confirmed";

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 bg-background ${
        isDenied ? "border-red-300 dark:border-red-800" : isPending ? "border-yellow-300 dark:border-yellow-800" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isConfirmed && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
          {isDenied && <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />}
          {isPending && <Clock className="h-3.5 w-3.5 text-yellow-600 shrink-0" />}
          <span className="font-medium text-sm truncate">{s.employee_name}</span>
          {s.worker_type === "freelancer" && (
            <Badge variant="outline" className="border-orange-400 text-orange-600 text-[9px] px-1 py-0 shrink-0">
              FL
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap ml-5">
          {s.job_title && <span>{s.job_title}</span>}
          {s.start_time && s.end_time && (
            <>
              <span>•</span>
              <span>{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span>
            </>
          )}
        </div>
        {s.denial_reason && (
          <div className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5 ml-5">
            <AlertTriangle className="h-3 w-3" />
            Motivo: {s.denial_reason}
          </div>
        )}
      </div>
      {isPending && (
        <a href={buildWhatsAppLink(s)} target="_blank" rel="noopener noreferrer" className="shrink-0">
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
  );
}
