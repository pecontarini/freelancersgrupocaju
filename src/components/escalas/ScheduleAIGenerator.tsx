// Painel lateral (Sheet) com chat IA dedicado a escalas.
// IA propõe → validador determinístico checa → usuário aplica no grid.

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Sparkles, ShieldCheck, AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useScheduleAIContext } from "@/hooks/useScheduleAIContext";
import { validateProposal, type ProposedShift, type Violation } from "@/lib/escalas/popValidator";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type ChatMsg = { role: "user" | "assistant"; content: string };

export type AIProposalShift = {
  employee_id: string;
  employee_name: string;
  date: string;
  schedule_type: "working" | "off" | "vacation" | "sick_leave";
  shift_type?: "T1" | "T2" | "T3" | "meia";
  start_time?: string | null;
  end_time?: string | null;
  break_min?: number;
};

interface Props {
  unitId: string | null;
  sectorId: string | null;
  sectorName: string;
  weekStart: string | null; // YYYY-MM-DD da segunda
  /**
   * Aplica a proposta no grid sem salvar — usuário ainda confirma manual com Salvar.
   * Reusa applyPatchToCells do ManualScheduleGrid através de callback.
   */
  onApplyProposal: (shifts: AIProposalShift[]) => Promise<void> | void;
}

export function ScheduleAIGenerator({ unitId, sectorId, sectorName, weekStart, onApplyProposal }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposta, setProposta] = useState<{
    resumo: string;
    avisos: string[];
    turnos: AIProposalShift[];
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: ctx, isLoading: loadingCtx } = useScheduleAIContext({ unitId, sectorId, weekStart });

  // Reset ao trocar setor/semana
  useEffect(() => {
    setMessages([]);
    setProposta(null);
  }, [sectorId, weekStart]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, proposta]);

  const validation = useMemo(() => {
    if (!proposta || !ctx) return null;
    const proposed: ProposedShift[] = proposta.turnos.map((t) => ({ ...t, sector_id: sectorId ?? undefined }));
    return validateProposal(proposed, {
      existing: ctx.existingShifts.map((s) => ({
        employee_id: s.employee_id,
        employee_name: s.employee_name,
        date: s.date,
        schedule_type: "working",
        shift_type: s.shift_type as any,
        start_time: s.start_time,
        end_time: s.end_time,
        break_min: s.break_min,
        sector_id: s.sector_id,
      })),
      staffing: ctx.staffing,
      weekDates: ctx.weekDates,
    });
  }, [proposta, ctx, sectorId]);

  async function send() {
    const text = input.trim();
    if (!text || !ctx) return;
    if (!sectorId || !weekStart) {
      toast.error("Selecione um setor e uma semana antes.");
      return;
    }
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-escala-ia", {
        body: {
          messages: next,
          context: {
            weekDates: ctx.weekDates,
            sectorName,
            employees: ctx.employees,
            staffing: ctx.staffing,
            existingShifts: ctx.existingShifts,
            absences: ctx.absences,
          },
        },
      });
      if (error) throw error;
      const reply = (data?.text as string) || "";
      setMessages([...next, { role: "assistant", content: reply }]);
      if (data?.proposta?.turnos?.length) {
        setProposta(data.proposta);
      }
    } catch (err: any) {
      const msg = err?.message ?? "Falha ao consultar IA";
      toast.error(msg);
      setMessages([...next, { role: "assistant", content: `❌ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function aplicar() {
    if (!proposta) return;
    if (validation && !validation.valid) {
      toast.error("Corrija as violações antes de aplicar.");
      return;
    }
    try {
      await onApplyProposal(proposta.turnos);
      toast.success(`Proposta aplicada no grid: ${proposta.turnos.length} turnos. Revise e clique em Salvar.`);
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao aplicar no grid");
    }
  }

  const errors = validation?.violations.filter((v) => v.level === "error") ?? [];
  const warnings = validation?.violations.filter((v) => v.level === "warning") ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={!sectorId || !weekStart}>
          <Wand2 className="h-3.5 w-3.5" />
          Gerador IA
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Gerador de escala (POP + CLT)
          </SheetTitle>
          <SheetDescription className="text-xs">
            {sectorName} · semana de {weekStart ? format(parseISO(weekStart), "dd/MM", { locale: ptBR }) : "—"}
            {ctx ? ` · ${ctx.employees.length} funcionários` : ""}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="p-4 space-y-4">
            {messages.length === 0 && !loading && (
              <Card className="p-4 bg-muted/30 border-dashed">
                <div className="text-sm font-medium mb-1">Como usar</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Descreva a necessidade da semana em linguagem natural. Exemplo:{" "}
                  <em>"Monte a escala da cozinha. João está de férias, Maria pediu folga sábado.
                  Não estourar 44h de ninguém."</em>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  A IA propõe respeitando POP + CLT. Você revisa, aplica no grid e salva.
                </p>
              </Card>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 ${
                  m.role === "user"
                    ? "bg-primary/10 ml-8"
                    : "bg-muted/50 mr-8 whitespace-pre-wrap"
                }`}
              >
                {m.content}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Pensando na escala...
              </div>
            )}

            {proposta && (
              <Card className="p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proposta de escala
                  </div>
                  {validation && (
                    <Badge variant={validation.valid ? "default" : "destructive"} className="gap-1">
                      {validation.valid ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {validation.valid ? "Válida" : `${errors.length} violação(ões)`}
                    </Badge>
                  )}
                </div>

                {proposta.resumo && (
                  <p className="text-xs text-muted-foreground">{proposta.resumo}</p>
                )}

                {proposta.avisos?.length > 0 && (
                  <div className="space-y-1">
                    {proposta.avisos.map((a, i) => (
                      <div key={i} className="text-xs flex gap-1.5 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        {a}
                      </div>
                    ))}
                  </div>
                )}

                {errors.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 space-y-1">
                    <div className="text-xs font-medium text-destructive">Violações que bloqueiam aplicação:</div>
                    {errors.slice(0, 8).map((v, i) => (
                      <ViolationRow key={i} v={v} />
                    ))}
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="rounded-md border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 p-2 space-y-1">
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-400">Avisos:</div>
                    {warnings.slice(0, 5).map((v, i) => (
                      <ViolationRow key={i} v={v} />
                    ))}
                  </div>
                )}

                <div className="text-[11px] text-muted-foreground border-t pt-2">
                  {proposta.turnos.filter((t) => t.schedule_type === "working").length} turnos de trabalho ·{" "}
                  {proposta.turnos.filter((t) => t.schedule_type === "off").length} folgas
                </div>

                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={aplicar}
                  disabled={!validation?.valid}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Aplicar no grid (revise antes de salvar)
                </Button>
              </Card>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3 space-y-2">
          {!sectorId && (
            <div className="text-xs text-amber-600">Selecione um setor para começar.</div>
          )}
          {loadingCtx && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando contexto operacional...
            </div>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Monte a escala respeitando os afastamentos. João folga terça, Maria volta de férias na quarta."
            rows={3}
            className="text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">Ctrl+Enter envia</span>
            <Button size="sm" onClick={send} disabled={loading || !input.trim() || !ctx} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ViolationRow({ v }: { v: Violation }) {
  return (
    <div className="text-[11px] flex gap-1.5 leading-snug">
      <span className="font-mono text-[10px] opacity-60 shrink-0">{v.rule}</span>
      <span>{v.message}</span>
    </div>
  );
}
