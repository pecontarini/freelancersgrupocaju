import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  Link2,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Send,
  Utensils,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import { EscalaApprovalPanel } from "./EscalaApprovalPanel";
import { EscalaVinculacaoBuilder } from "./EscalaVinculacaoBuilder";

const UNIDADE_ID_ITAIM = "87228077-03ab-445b-a409-237972ee6719";

const SETORES = [
  "COZINHA", "BAR", "GARÇOM", "CUMIN", "PARRILLA",
  "HOSTESS", "DELIVERY", "SUBCHEFE SALÃO", "ASG", "PRODUÇÃO",
] as const;

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
const DIA_LABEL: Record<string, string> = {
  SEG: "Segunda", TER: "Terça", QUA: "Quarta", QUI: "Quinta",
  SEX: "Sexta", SAB: "Sábado", DOM: "Domingo",
};

function currentMonday(from = new Date()): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Dom, 1=Seg
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

type EscalaMinimaRow = {
  dia_semana: string;
  turno: string;
  qtd_efetivos: number;
  qtd_extras: number;
};

type TurnoConfigRow = {
  modelo_folga: string | null;
  qtd_abridores: number | null;
  qtd_fechadores: number | null;
  qtd_intermediarios: number | null;
  observacoes: string | null;
};

export function EscalasItaimSection() {
  const [setorAtivo, setSetorAtivo] = useState<string>("COZINHA");
  const [semanaInicio, setSemanaInicio] = useState<Date>(() => currentMonday());
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [escalaGerada, setEscalaGerada] = useState<any>(null);

  const semanaFim = useMemo(() => {
    const d = new Date(semanaInicio);
    d.setDate(d.getDate() + 6);
    return d;
  }, [semanaInicio]);

  const semanaIso = toISO(semanaInicio);

  const { data: template, refetch, isLoading } = useQuery({
    queryKey: ["escala_template_itaim", setorAtivo, semanaIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escala_template")
        .select("id, status, comentario_rejeicao, gerado_em, payload")
        .eq("unidade_id", UNIDADE_ID_ITAIM)
        .eq("setor", setorAtivo)
        .eq("semana_inicio", semanaIso)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: minima } = useQuery({
    queryKey: ["escala_minima_itaim", setorAtivo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escala_minima")
        .select("dia_semana, turno, qtd_efetivos, qtd_extras")
        .eq("unidade_id", UNIDADE_ID_ITAIM)
        .eq("setor", setorAtivo);
      if (error) throw error;
      return (data ?? []) as EscalaMinimaRow[];
    },
  });

  const { data: config } = useQuery({
    queryKey: ["turno_config_itaim", setorAtivo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turno_config")
        .select("modelo_folga, qtd_abridores, qtd_fechadores, qtd_intermediarios, observacoes")
        .eq("unidade_id", UNIDADE_ID_ITAIM)
        .eq("setor", setorAtivo)
        .maybeSingle();
      if (error) throw error;
      return data as TurnoConfigRow | null;
    },
  });

  const moveSemana = (delta: number) => {
    const d = new Date(semanaInicio);
    d.setDate(d.getDate() + delta * 7);
    setSemanaInicio(d);
    setEscalaGerada(null);
  };

  const handleSetSetor = (s: string) => {
    setSetorAtivo(s);
    setEscalaGerada(null);
  };

  const gerar = async () => {
    setGerando(true);
    setEscalaGerada(null);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-escala-ia", {
        body: { setor: setorAtivo, semana_inicio: semanaIso, unidade_id: UNIDADE_ID_ITAIM },
      });
      if (error) throw error;
      if (data?.error && !data?.template_id && !data?.escala) throw new Error(data.error);
      setEscalaGerada(data?.escala ?? null);
      toast.success("Escala gerada — revise antes de enviar ao COO");
      await refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar escala");
    } finally {
      setGerando(false);
    }
  };

  const enviarAprovacao = async () => {
    if (!template?.id) return;
    setEnviando(true);
    try {
      const { error } = await supabase
        .from("escala_template")
        .update({ status: "pendente_aprovacao" })
        .eq("id", template.id);
      if (error) throw error;
      toast.success("Enviado para aprovação do COO");
      setEscalaGerada(null);
      await refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar");
    } finally {
      setEnviando(false);
    }
  };

  const matriz = useMemo(() => {
    const m: Record<string, Record<string, EscalaMinimaRow | null>> = {};
    for (const d of DIAS) m[d] = { ALMOCO: null, JANTAR: null };
    (minima ?? []).forEach((r) => {
      const turno = r.turno === "TARDE" ? "ALMOCO" : r.turno;
      if (m[r.dia_semana] && (turno === "ALMOCO" || turno === "JANTAR")) {
        m[r.dia_semana][turno] = r;
      }
    });
    return m;
  }, [minima]);

  const escalaParaExibir =
    escalaGerada ?? (template?.payload && template.status !== "aprovado" ? template.payload : null);

  // ------- UI helpers -------
  const TabelaMinima = (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Tabela Mínima POP
          </CardTitle>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20">
            Aprovada pelo Conselho
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-separate border-spacing-y-1">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium pr-2">Turno</th>
                {DIAS.map((d) => (
                  <th key={d} className="font-medium text-center px-1">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["ALMOCO", "JANTAR"] as const).map((turno) => (
                <tr key={turno}>
                  <td className="pr-2 font-medium flex items-center gap-1.5 py-1.5">
                    {turno === "ALMOCO" ? (
                      <Utensils className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Moon className="h-3.5 w-3.5 text-primary" />
                    )}
                    {turno === "ALMOCO" ? "Almoço" : "Jantar"}
                  </td>
                  {DIAS.map((d) => {
                    const cell = matriz[d][turno];
                    const ef = cell?.qtd_efetivos ?? 0;
                    const ex = cell?.qtd_extras ?? 0;
                    return (
                      <td key={d} className="text-center px-1">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="font-semibold">{ef}</span>
                          {ex > 0 && (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 px-1.5 py-0 text-[10px]">
                              +{ex} ext
                            </Badge>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const ResumoConfig = (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resumo do Setor</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-muted-foreground">Setor</div>
            <div className="font-medium">{setorAtivo}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Semana</div>
            <div className="font-medium">{formatDate(semanaInicio)} – {formatDate(semanaFim)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Modelo de folga</div>
            <div className="font-medium">{config?.modelo_folga ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Headcount</div>
            <div className="font-medium">
              {(config?.qtd_abridores ?? 0) + (config?.qtd_fechadores ?? 0) + (config?.qtd_intermediarios ?? 0)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline">Abridores: {config?.qtd_abridores ?? 0}</Badge>
          <Badge variant="outline">Fechadores: {config?.qtd_fechadores ?? 0}</Badge>
          <Badge variant="outline">Intermediários: {config?.qtd_intermediarios ?? 0}</Badge>
        </div>
        {config?.observacoes && (
          <p className="text-xs text-muted-foreground italic pt-1">"{config.observacoes}"</p>
        )}
      </CardContent>
    </Card>
  );

  const renderHorario = (s: any) => {
    const t1 = s.entrada_1 && s.saida_1 ? `T1: ${s.entrada_1}→${s.saida_1}` : null;
    const t2 = s.entrada_2 && s.saida_2 ? `T2: ${s.entrada_2}→${s.saida_2}` : null;
    const gap = s.gap_min ? `⏸${(s.gap_min / 60).toFixed(s.gap_min % 60 === 0 ? 0 : 1)}h` : null;
    return [t1, gap, t2].filter(Boolean).join(" · ");
  };

  const EscalaPreview = escalaParaExibir && (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Escala gerada — pré-visualização</CardTitle>
          {escalaParaExibir?.validacao?.aprovado && (
            <Badge className="bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> CLT OK
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.isArray(escalaParaExibir?.validacao?.alertas_clt) &&
          escalaParaExibir.validacao.alertas_clt.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium mb-1">
                <AlertTriangle className="h-4 w-4" /> Violações CLT detectadas
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {escalaParaExibir.validacao.alertas_clt.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

        <Accordion type="multiple" className="w-full">
          {(Array.isArray(escalaParaExibir?.dias)
            ? escalaParaExibir.dias
            : escalaParaExibir?.dias && typeof escalaParaExibir.dias === "object"
              ? Object.entries(escalaParaExibir.dias).map(([dia, v]: [string, any]) => ({ dia, ...(v ?? {}) }))
              : []
          ).map((dia: any, idx: number) => (
            <AccordionItem key={idx} value={`dia-${idx}`}>
              <AccordionTrigger className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{DIA_LABEL[dia.dia] ?? dia.dia}</span>
                  {dia.data && <span className="text-xs text-muted-foreground">({dia.data})</span>}
                  <Badge variant="outline" className="ml-2">{(dia.slots ?? []).length} slots</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {(dia.slots ?? []).map((s: any, i: number) => {
                    const isExtra = s.tipo === "EXTRA" || s.is_extra === true;
                    return (
                      <div
                        key={i}
                        className={
                          "rounded-md border p-2.5 text-sm flex flex-wrap items-center gap-x-4 gap-y-1 " +
                          (isExtra
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-background border-border")
                        }
                      >
                        <div className="font-medium min-w-[110px]">
                          {isExtra
                            ? `EXTRA ${s.cobertura ?? s.turno_cobertura ?? "JANTAR"}`
                            : s.tipo ?? "Turno"}
                        </div>
                        <div className="font-mono text-xs">{renderHorario(s)}</div>
                        {s.jornada_total && (
                          <Badge variant="outline" className="text-xs">{s.jornada_total}</Badge>
                        )}
                        <div className="flex items-center gap-1 text-xs">
                          {s.cobre_almoco && <span className="text-emerald-600">✓ Almoço</span>}
                          {s.cobre_jantar && <span className="text-emerald-600">✓ Jantar</span>}
                        </div>
                        <Badge className="ml-auto" variant="secondary">
                          {isExtra ? `+${s.qtd ?? 1} freelancers` : `${s.qtd ?? 1}x`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {template?.id && template.status === "pendente_aprovacao" ? (
          <Badge className="bg-amber-500/15 text-amber-700 border border-amber-500/30">
            <Clock className="h-3.5 w-3.5 mr-1" /> Já enviado para aprovação do COO
          </Badge>
        ) : (
          <Button
            onClick={enviarAprovacao}
            disabled={
              enviando ||
              !template?.id ||
              (escalaParaExibir?.validacao?.alertas_clt?.length ?? 0) > 0
            }
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar para aprovação do COO
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const renderStatus = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      );
    }

    // Sem template OU template rejeitado/sem payload exibível: mostrar gerador
    const showGerador =
      !template ||
      (template.status === "rejeitado" && !escalaGerada) ||
      escalaGerada ||
      (template.status === "pendente_aprovacao");

    return (
      <div className="space-y-4">
        {/* Painel de aprovação do COO */}
        {template?.status === "pendente_aprovacao" && template?.id && template?.payload && (
          <>
            <EscalaApprovalPanel
              templateId={template.id}
              setor={setorAtivo}
              semanaLabel={`${formatDate(semanaInicio)} a ${formatDate(semanaFim)}`}
              payload={template.payload}
              onChanged={() => {
                setEscalaGerada(null);
                refetch();
              }}
            />
            <CooApprovalLinkBox
              templateId={template.id}
              setor={setorAtivo}
              semanaLabel={`${formatDate(semanaInicio)} a ${formatDate(semanaFim)}`}
              unidadeNome="Caju Limão Itaim"
            />
          </>
        )}

        {/* Status do template no topo */}
        {template?.status === "pendente_aprovacao" && !escalaGerada && (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <Clock className="h-3.5 w-3.5 mr-1" /> Aguardando aprovação do COO
          </Badge>
        )}
        {template?.status === "aprovado" && (
          <div className="space-y-4">
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovado
            </Badge>
            {template.id && template.payload && (
              <EscalaVinculacaoBuilder
                templateId={template.id}
                unidadeId={UNIDADE_ID_ITAIM}
                setor={setorAtivo}
                payload={template.payload}
                semanaInicio={semanaInicio}
                semanaFim={semanaFim}
              />
            )}
          </div>
        )}
        {template?.status === "rejeitado" && (
          <div className="flex flex-col gap-2">
            <Badge variant="destructive">
              <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitado pelo COO
            </Badge>
            {template.comentario_rejeicao && (
              <p className="text-sm text-muted-foreground italic">"{template.comentario_rejeicao}"</p>
            )}
          </div>
        )}

        {showGerador && template?.status !== "aprovado" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {TabelaMinima}
            <div className="space-y-4">
              {ResumoConfig}
              <Card className="glass-card">
                <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
                  {gerando ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Agente calculando os horários…
                      </p>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-8 w-8 text-primary" />
                      <p className="text-sm text-muted-foreground">
                        {escalaParaExibir
                          ? "Você pode regerar para obter outra distribuição."
                          : "Gere uma proposta de horários respeitando o POP mínimo."}
                      </p>
                      <Button
                        onClick={gerar}
                        disabled={gerando}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {escalaParaExibir ? "Regerar com IA" : "Gerar com IA"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {EscalaPreview}
      </div>
    );
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20">
          MVP · Caju Limão Itaim
        </Badge>
        <h2 className="text-xl font-semibold tracking-tight">Gerador de Escalas com IA</h2>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-2 min-w-max pb-1">
          {SETORES.map((s) => {
            const ativo = s === setorAtivo;
            return (
              <button
                key={s}
                onClick={() => handleSetSetor(s)}
                className={
                  "px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border " +
                  (ativo
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-foreground border-border hover:bg-muted")
                }
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => moveSemana(-1)} aria-label="Semana anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium px-2 min-w-[200px] text-center">
          Semana de {formatDate(semanaInicio)} a {formatDate(semanaFim)}
        </div>
        <Button variant="outline" size="icon" onClick={() => moveSemana(1)} aria-label="Próxima semana">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {setorAtivo} · Semana {formatDate(semanaInicio)}
          </CardTitle>
        </CardHeader>
        <CardContent>{renderStatus()}</CardContent>
      </Card>
    </section>
  );
}
