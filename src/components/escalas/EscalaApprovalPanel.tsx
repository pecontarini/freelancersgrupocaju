import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, X, Loader2, Send, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
const DIA_LABEL: Record<string, string> = {
  SEG: "Segunda", TER: "Terça", QUA: "Quarta", QUI: "Quinta",
  SEX: "Sexta", SAB: "Sábado", DOM: "Domingo",
};

type TimePart = { entrada: string; saida: string; efetivo_min?: number; cruza_meia_noite?: boolean };
type Slot = {
  tipo: string;
  quantidade?: number;
  qtd?: number;
  responsavel?: boolean;
  t1?: TimePart | null;
  t2?: TimePart | null;
  break_min?: number;
  jornada_dia_min?: number;
  cobre_almoco?: boolean;
  cobre_jantar?: boolean;
  obs?: string;
};
type DiaPayload = {
  tipo_dia?: string;
  fechamento?: string;
  pop_almoco?: number;
  pop_jantar?: number;
  pop_almoco_coberto?: number;
  pop_jantar_coberto?: number;
  slots?: Slot[];
  extras?: Slot[];
};

type Props = {
  templateId: string;
  setor: string;
  semanaLabel: string;
  payload: any;
  onChanged: () => void;
};

function toMin(hhmm?: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
function diffMin(start?: string, end?: string): number {
  const s = toMin(start);
  const e = toMin(end);
  if (s === null || e === null) return 0;
  let d = e - s;
  if (d < 0) d += 24 * 60; // cruza meia-noite
  return d;
}
function calcJornadaMin(slot: Slot): number {
  const t1Bruto = slot.t1?.entrada && slot.t1?.saida ? diffMin(slot.t1.entrada, slot.t1.saida) : 0;
  const t2Bruto = slot.t2?.entrada && slot.t2?.saida ? diffMin(slot.t2.entrada, slot.t2.saida) : 0;
  const bruto = t1Bruto + t2Bruto;
  if (bruto <= 360) return bruto;
  return bruto - 60; // >6h efetiva = bruto - 1h (almoço)
}
function fmtH(min: number): string {
  if (!min) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
function renderHorarioSlot(s: Slot): string {
  const t1 = s.t1?.entrada && s.t1?.saida ? `T1: ${s.t1.entrada}→${s.t1.saida}` : null;
  const t2 = s.t2?.entrada && s.t2?.saida ? `T2: ${s.t2.entrada}→${s.t2.saida}` : null;
  const gap = s.break_min ? `⏸${(s.break_min / 60).toFixed(s.break_min % 60 === 0 ? 0 : 1)}h` : null;
  return [t1, t1 && t2 ? gap : null, t2].filter(Boolean).join(" · ");
}

export function EscalaApprovalPanel({ templateId, setor, semanaLabel, payload, onChanged }: Props) {
  const { user } = useAuth();
  const [comentario, setComentario] = useState("");
  const [acao, setAcao] = useState<"aprovar" | "rejeitar" | null>(null);

  // Estado editável: clonamos os dias do payload
  const [diasEdit, setDiasEdit] = useState<Record<string, DiaPayload>>(() => {
    const base: Record<string, DiaPayload> = {};
    const src = payload?.dias ?? {};
    for (const d of DIAS) {
      const orig = src[d] ?? {};
      base[d] = JSON.parse(JSON.stringify(orig));
    }
    return base;
  });

  const updateSlotTime = (
    dia: string,
    slotIdx: number,
    turno: "t1" | "t2",
    campo: "entrada" | "saida",
    valor: string,
  ) => {
    setDiasEdit((prev) => {
      const next = { ...prev };
      const d = { ...(next[dia] ?? {}) };
      const slots = [...(d.slots ?? [])];
      const s: Slot = { ...(slots[slotIdx] ?? { tipo: "" }) };
      const cur: TimePart = { entrada: "", saida: "", ...(s[turno] ?? {}) };
      cur[campo] = valor;
      s[turno] = cur;
      s.jornada_dia_min = calcJornadaMin(s);
      slots[slotIdx] = s;
      d.slots = slots;
      next[dia] = d;
      return next;
    });
  };

  // Checks
  const checks = useMemo(() => {
    let chk1 = true; // jornada <= 600 min ef
    let chk2 = true; // pop almoço coberto
    let chk3 = true; // pop jantar coberto
    let chk4 = true; // qui-sab fechadores sem t1
    let chk5 = true; // pico 17-21 cobertos: jantar com entrada <= 18:00
    let temAlgumDia = false;

    for (const d of DIAS) {
      const dia = diasEdit[d];
      if (!dia) continue;
      const slots = [...(dia.slots ?? []), ...(dia.extras ?? [])];
      if (slots.length === 0) continue;
      temAlgumDia = true;

      for (const s of slots) {
        const j = s.jornada_dia_min ?? calcJornadaMin(s);
        if (j > 600) chk1 = false;

        // Pico jantar
        if (s.cobre_jantar || /JANTAR|FECHADOR|DOBRA|EXTRA-JANTAR/i.test(s.tipo ?? "")) {
          const ent = toMin(s.t2?.entrada ?? s.t1?.entrada);
          if (ent !== null && ent > 18 * 60) chk5 = false;
        }
      }

      // POP cobertos
      if ((dia.pop_almoco_coberto ?? 0) < (dia.pop_almoco ?? 0)) chk2 = false;
      if ((dia.pop_jantar_coberto ?? 0) < (dia.pop_jantar ?? 0)) chk3 = false;

      // Qui/Sex/Sáb fechadores puros não têm t1
      if (["QUI", "SEX", "SAB"].includes(d)) {
        for (const s of dia.slots ?? []) {
          if (/FECHADOR-PURO|FECHADOR_PURO|FECHADOR PURO/i.test(s.tipo ?? "")) {
            if (s.t1 && s.t1.entrada) chk4 = false;
          }
        }
      }
    }

    return {
      chk1, chk2, chk3, chk4, chk5,
      todosOk: temAlgumDia && chk1 && chk2 && chk3 && chk4 && chk5,
    };
  }, [diasEdit]);

  const aprovar = async () => {
    if (!checks.todosOk) return;
    setAcao("aprovar");
    try {
      const novoPayload = { ...(payload ?? {}), dias: diasEdit };
      const { error } = await supabase
        .from("escala_template")
        .update({
          status: "aprovado",
          aprovado_por: user?.email ?? user?.id ?? "desconhecido",
          aprovado_em: new Date().toISOString(),
          payload: novoPayload,
        })
        .eq("id", templateId);
      if (error) throw error;
      toast.success("Escala aprovada! ✓");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao aprovar");
    } finally {
      setAcao(null);
    }
  };

  const rejeitar = async () => {
    setAcao("rejeitar");
    try {
      const { error } = await supabase
        .from("escala_template")
        .update({
          status: "rejeitado",
          comentario_rejeicao: comentario || null,
        })
        .eq("id", templateId);
      if (error) throw error;
      toast.success("Revisão solicitada");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao solicitar revisão");
    } finally {
      setAcao(null);
    }
  };

  const CheckRow = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <X className="h-4 w-4 text-destructive" />
      )}
      <span className={ok ? "text-foreground" : "text-destructive"}>{label}</span>
    </div>
  );

  return (
    <Card className="glass-card border-amber-500/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Revisão de Horários — {setor} — Semana {semanaLabel}
          </CardTitle>
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse">
            <Clock className="h-3.5 w-3.5 mr-1" /> Aguardando aprovação do COO
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Checklist */}
        <div className="rounded-md border bg-background/50 p-3 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground mb-1">Validação automática</div>
          <CheckRow ok={checks.chk1} label="Nenhum slot acima de 10h efetivas" />
          <CheckRow ok={checks.chk2} label="POP almoço coberto em todos os dias" />
          <CheckRow ok={checks.chk3} label="POP jantar coberto em todos os dias" />
          <CheckRow ok={checks.chk4} label="Qui–Sáb: fechadores puros sem T1" />
          <CheckRow ok={checks.chk5} label="Pico 17h–21h coberto (jantar inicia até 18h)" />
        </div>

        {/* Accordion por dia */}
        <Accordion type="multiple" className="w-full">
          {DIAS.map((d) => {
            const dia = diasEdit[d];
            const slots = dia?.slots ?? [];
            const extras = dia?.extras ?? [];
            if (slots.length === 0 && extras.length === 0) return null;
            return (
              <AccordionItem key={d} value={d}>
                <AccordionTrigger className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{DIA_LABEL[d]}</span>
                    {dia?.tipo_dia && (
                      <Badge variant="outline" className="text-xs">Tipo {dia.tipo_dia}</Badge>
                    )}
                    {dia?.fechamento && (
                      <span className="text-xs text-muted-foreground">Fecha {dia.fechamento}</span>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {slots.length + extras.length} slots
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b">
                          <th className="text-left font-medium py-2 pr-2">Tipo</th>
                          <th className="text-left font-medium py-2 pr-2">T1 entrada</th>
                          <th className="text-left font-medium py-2 pr-2">T1 saída</th>
                          <th className="text-left font-medium py-2 pr-2">T2 entrada</th>
                          <th className="text-left font-medium py-2 pr-2">T2 saída</th>
                          <th className="text-left font-medium py-2 pr-2">Jornada ef.</th>
                          <th className="text-center font-medium py-2 pr-2">Almoço</th>
                          <th className="text-center font-medium py-2 pr-2">Jantar</th>
                          <th className="text-right font-medium py-2">Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((s, i) => {
                          const j = s.jornada_dia_min ?? calcJornadaMin(s);
                          const tooLong = j > 600;
                          return (
                            <tr key={`s-${i}`} className="border-b">
                              <td className="py-1.5 pr-2 font-medium">{s.tipo}</td>
                              <td className="pr-2">
                                <Input
                                  type="time"
                                  value={s.t1?.entrada ?? ""}
                                  onChange={(e) => updateSlotTime(d, i, "t1", "entrada", e.target.value)}
                                  className="h-8 w-[110px]"
                                />
                              </td>
                              <td className="pr-2">
                                <Input
                                  type="time"
                                  value={s.t1?.saida ?? ""}
                                  onChange={(e) => updateSlotTime(d, i, "t1", "saida", e.target.value)}
                                  className="h-8 w-[110px]"
                                />
                              </td>
                              <td className="pr-2">
                                <Input
                                  type="time"
                                  value={s.t2?.entrada ?? ""}
                                  onChange={(e) => updateSlotTime(d, i, "t2", "entrada", e.target.value)}
                                  className="h-8 w-[110px]"
                                />
                              </td>
                              <td className="pr-2">
                                <Input
                                  type="time"
                                  value={s.t2?.saida ?? ""}
                                  onChange={(e) => updateSlotTime(d, i, "t2", "saida", e.target.value)}
                                  className="h-8 w-[110px]"
                                />
                              </td>
                              <td className={"pr-2 font-mono " + (tooLong ? "text-destructive font-semibold" : "")}>
                                {fmtH(j)}
                              </td>
                              <td className="text-center pr-2">
                                {s.cobre_almoco ? <Check className="h-3.5 w-3.5 inline text-emerald-600" /> : "—"}
                              </td>
                              <td className="text-center pr-2">
                                {s.cobre_jantar ? <Check className="h-3.5 w-3.5 inline text-emerald-600" /> : "—"}
                              </td>
                              <td className="text-right font-medium">{s.quantidade ?? s.qtd ?? 1}x</td>
                            </tr>
                          );
                        })}
                        {extras.map((s, i) => (
                          <tr key={`e-${i}`} className="bg-amber-500/10 border-b border-amber-500/30">
                            <td className="py-1.5 pr-2 font-medium text-amber-800 dark:text-amber-300" colSpan={5}>
                              EXTRA JANTAR · {renderHorarioSlot(s) || "—"}
                            </td>
                            <td className="pr-2 font-mono">{fmtH(s.jornada_dia_min ?? calcJornadaMin(s))}</td>
                            <td className="text-center pr-2">—</td>
                            <td className="text-center pr-2">
                              <Check className="h-3.5 w-3.5 inline text-amber-600" />
                            </td>
                            <td className="text-right font-medium text-amber-800 dark:text-amber-300">
                              +{s.quantidade ?? s.qtd ?? 1} freelancers
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Rodapé */}
        <div className="space-y-3 pt-2">
          <Textarea
            placeholder="Comentário (opcional)"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="min-h-[70px]"
          />
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button
              variant="outline"
              onClick={rejeitar}
              disabled={acao !== null}
            >
              {acao === "rejeitar" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Solicitar revisão
            </Button>
            <Button
              onClick={aprovar}
              disabled={!checks.todosOk || acao !== null}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {acao === "aprovar" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Aprovar horários
            </Button>
          </div>
          {!checks.todosOk && (
            <p className="text-xs text-muted-foreground text-right">
              Todos os 5 checks precisam estar verdes para aprovar.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
