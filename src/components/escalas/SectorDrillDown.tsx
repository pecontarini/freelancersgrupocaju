import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, XCircle, MessageCircle, UserPlus } from "lucide-react";
import type { PopDiarioRow } from "@/hooks/usePopDiario";

interface SectorDrillDownProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sectorName: string;
  unitName: string;
  row: PopDiarioRow | null;
}

const ATRASO_THRESHOLD = 15;

function hhmm(t: string | null | undefined): string {
  if (!t) return "—";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function waLink(phone: string | null | undefined, name: string, unitName: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const e164 = digits.startsWith("55") ? digits : `55${digits}`;
  const primeiroNome = name.split(/\s+/)[0] || name;
  const msg = encodeURIComponent(
    `Olá, ${primeiroNome}! Aqui é da operação ${unitName}. Notamos que você está escalado(a) hoje e ainda não bateu ponto. Está tudo bem? Conseguimos contar com sua presença?`,
  );
  return `https://wa.me/${e164}?text=${msg}`;
}

export function SectorDrillDown({
  open,
  onOpenChange,
  sectorName,
  unitName,
  row,
}: SectorDrillDownProps) {
  if (!row) return null;

  const presentesIds = new Set(row.presentes_lista.map((p) => p.employee_id));
  const escalados = row.escalados_lista;
  const presentesComEscala = escalados.filter((e) => presentesIds.has(e.employee_id));
  const faltantes = escalados.filter((e) => !presentesIds.has(e.employee_id));
  const extras = row.extras_lista ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            {sectorName} — {row.turno === "ALMOCO" ? "Almoço" : "Jantar"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {unitName} · POP mínimo: {row.sem_pop ? "—" : row.pop_minimo} ·
            Escalados: {row.escalados} · Presentes: {row.presentes} ·
            Extras: {row.extras_freelancer}
            {row.sem_pop && (
              <Badge variant="outline" className="ml-2 bg-muted text-muted-foreground border-border text-[10px]">
                Sem POP
              </Badge>
            )}
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-2">
            {/* PRESENTES */}
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Presentes ({presentesComEscala.length})
              </h4>
              {presentesComEscala.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ninguém bateu ponto ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {presentesComEscala.map((p) => {
                    const atrasado = (p.atraso_min ?? 0) > ATRASO_THRESHOLD;
                    return (
                      <li
                        key={p.employee_id}
                        className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-green-50/60"
                      >
                        {atrasado ? (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        )}
                        <span className="flex-1 truncate font-medium">{p.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {hhmm(p.start)}→{hhmm(p.end)}
                        </span>
                        <span className="text-xs">bateu {hhmm(p.punch_in)}</span>
                        {atrasado && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">
                            +{p.atraso_min}min
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* EXTRAS (FREELANCERS) */}
            {extras.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2 flex items-center gap-1">
                  <UserPlus className="h-3.5 w-3.5" /> Presentes sem escala — Freelancers ({extras.length})
                </h4>
                <ul className="space-y-1.5">
                  {extras.map((p) => (
                    <li
                      key={p.employee_id}
                      className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-blue-50/60"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="flex-1 truncate font-medium">{p.name}</span>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-[10px]">
                        freelancer
                      </Badge>
                      <span className="text-xs">bateu {hhmm(p.punch_in)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* FALTANTES */}
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> Faltantes ({faltantes.length})
              </h4>
              {faltantes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum faltante 🎯</p>
              ) : (
                <ul className="space-y-1.5">
                  {faltantes.map((p) => {
                    const wa = waLink(p.phone, p.name, unitName);
                    return (
                      <li
                        key={p.employee_id}
                        className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-red-50/60"
                      >
                        <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span className="flex-1 truncate font-medium text-red-900">{p.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {hhmm(p.start)}→{hhmm(p.end)}
                        </span>
                        {wa ? (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] gap-1 bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                          >
                            <a href={wa} target="_blank" rel="noreferrer">
                              <MessageCircle className="h-3 w-3" /> WhatsApp
                            </a>
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">sem telefone</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
