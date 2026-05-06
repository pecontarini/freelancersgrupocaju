import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, ShieldCheck, Check, X, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
const DIA_LABEL: Record<string, string> = {
  SEG: "Segunda", TER: "Terça", QUA: "Quarta", QUI: "Quinta",
  SEX: "Sexta", SAB: "Sábado", DOM: "Domingo",
};

function fmtH(min: number) {
  if (!min) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
function diffMin(s?: string, e?: string) {
  if (!s || !e) return 0;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  let d = (eh * 60 + em) - (sh * 60 + sm);
  if (d < 0) d += 1440;
  return d;
}
function jornada(slot: any) {
  const t1 = slot.t1?.entrada && slot.t1?.saida ? diffMin(slot.t1.entrada, slot.t1.saida) : 0;
  const t2 = slot.t2?.entrada && slot.t2?.saida ? diffMin(slot.t2.entrada, slot.t2.saida) : 0;
  const bruto = t1 + t2;
  return bruto > 360 ? bruto - 60 : bruto;
}

export default function AprovarEscala() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tpl, setTpl] = useState<any>(null);
  const [linkInfo, setLinkInfo] = useState<any>(null);
  const [comentario, setComentario] = useState("");
  const [aprovador, setAprovador] = useState("");
  const [pin, setPin] = useState("");
  const [acao, setAcao] = useState<"aprovar" | "rejeitar" | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("escala-aprovacao-info", {
          body: undefined,
          method: "GET",
          headers: {},
          // @ts-expect-error custom query
          query: { token },
        }).catch(async () => {
          // fallback via fetch direto se invoke não suporta query
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escala-aprovacao-info?token=${encodeURIComponent(token)}`;
          const r = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
          return { data: await r.json(), error: null as any };
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setTpl((data as any).template);
        setLinkInfo((data as any).link);
      } catch (e: any) {
        setError(e.message ?? "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const dias = useMemo(() => {
    const src = tpl?.payload?.dias ?? {};
    return DIAS.map((d) => ({ dia: d, ...(src[d] ?? {}) }));
  }, [tpl]);

  const decidir = async (decisao: "aprovar" | "rejeitar") => {
    if (!pin.trim()) {
      toast.error("Informe o PIN do COO");
      return;
    }
    setAcao(decisao);
    try {
      const { data, error } = await supabase.functions.invoke("escala-aprovacao-decidir", {
        body: { token, decisao, comentario, aprovador_nome: aprovador || undefined, pin: pin.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(decisao === "aprovar" ? "Escala aprovada!" : "Revisão solicitada");
      setLinkInfo({ usado_em: new Date().toISOString(), decisao });
      setTpl((t: any) => ({ ...t, status: decisao === "aprovar" ? "aprovado" : "rejeitado" }));
    } catch (e: any) {
      const msg = String(e?.message ?? "Falha");
      toast.error(msg.includes("PIN") ? "PIN inválido" : msg);
    } finally {
      setAcao(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Link inválido
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const jaUsado = !!linkInfo?.usado_em || tpl.status !== "pendente_aprovacao";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold">Aprovação de Escala</h1>
          <p className="text-sm text-muted-foreground">
            {tpl.unidade_nome ?? "—"} · {tpl.setor} · Semana {tpl.semana_inicio}
          </p>
        </div>

        {jaUsado && (
          <Card className="border-emerald-500/30">
            <CardContent className="pt-6 flex items-center gap-3">
              {tpl.status === "aprovado" ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  <div>
                    <div className="font-medium">Escala aprovada</div>
                    {tpl.aprovado_por && (
                      <div className="text-xs text-muted-foreground">
                        por {tpl.aprovado_por} {tpl.aprovado_em && `· ${new Date(tpl.aprovado_em).toLocaleString("pt-BR")}`}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <X className="h-6 w-6 text-destructive" />
                  <div>
                    <div className="font-medium">Revisão solicitada</div>
                    {tpl.comentario_rejeicao && (
                      <div className="text-xs text-muted-foreground">"{tpl.comentario_rejeicao}"</div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Horários propostos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {dias.map((d: any) => {
                const slots = [...(d.slots ?? []), ...(d.extras ?? [])];
                if (slots.length === 0) {
                  return (
                    <AccordionItem key={d.dia} value={d.dia}>
                      <AccordionTrigger className="text-sm">
                        <span>{DIA_LABEL[d.dia]} <span className="text-muted-foreground text-xs ml-2">folga</span></span>
                      </AccordionTrigger>
                    </AccordionItem>
                  );
                }
                return (
                  <AccordionItem key={d.dia} value={d.dia}>
                    <AccordionTrigger className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{DIA_LABEL[d.dia]}</span>
                        <Badge variant="outline" className="text-xs">{slots.length} slots</Badge>
                        {d.tipo_dia && <Badge variant="secondary" className="text-xs">Tipo {d.tipo_dia}</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b">
                              <th className="text-left font-medium py-2 pr-2">Tipo</th>
                              <th className="text-left font-medium py-2 pr-2">T1</th>
                              <th className="text-left font-medium py-2 pr-2">T2</th>
                              <th className="text-left font-medium py-2 pr-2">Jornada</th>
                              <th className="text-right font-medium py-2">Qtd</th>
                            </tr>
                          </thead>
                          <tbody>
                            {slots.map((s: any, i: number) => (
                              <tr key={i} className="border-b">
                                <td className="py-1.5 pr-2 font-medium">{s.tipo}{s.responsavel ? " ★" : ""}</td>
                                <td className="pr-2 font-mono">{s.t1?.entrada ? `${s.t1.entrada}–${s.t1.saida}` : "—"}</td>
                                <td className="pr-2 font-mono">{s.t2?.entrada ? `${s.t2.entrada}–${s.t2.saida}` : "—"}</td>
                                <td className="pr-2 font-mono">{fmtH(s.jornada_dia_min ?? jornada(s))}</td>
                                <td className="text-right font-medium">{s.quantidade ?? s.qtd ?? 1}x</td>
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
          </CardContent>
        </Card>

        {!jaUsado && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" /> Decisão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Seu nome (opcional)"
                value={aprovador}
                onChange={(e) => setAprovador(e.target.value)}
              />
              <Textarea
                placeholder="Comentário (obrigatório se rejeitar)"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="min-h-[70px]"
              />
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => decidir("rejeitar")}
                  disabled={acao !== null || !comentario.trim()}
                >
                  {acao === "rejeitar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                  Solicitar revisão
                </Button>
                <Button
                  onClick={() => decidir("aprovar")}
                  disabled={acao !== null}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {acao === "aprovar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Aprovar escala
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
