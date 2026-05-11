import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, Copy, ArrowRight, ListChecks, XCircle } from "lucide-react";
import { toast } from "sonner";
import { insertDraftSlots, type DraftSlot, type DraftDay } from "@/hooks/useAIDraftSlots";

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;

// Normaliza qualquer data YYYY-MM-DD para a segunda-feira (00:00) da mesma semana ISO.
// Mantém string pura para evitar problemas de timezone.
function toMondayISO(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const dow = dt.getUTCDay(); // 0=Dom..6=Sab
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

interface TurnoConfigRow {
  id: string;
  setor: string;
  modelo_folga: string | null;
  qtd_abridores: number;
  qtd_fechadores: number;
  qtd_intermediarios: number;
  observacoes: string | null;
}

interface EscalaMinimaRow {
  setor: string;
  dia_semana: string;
  turno: string;
  qtd_efetivos: number;
  qtd_extras: number;
}

interface SlotResponse {
  tipo: string;
  quantidade: number;
  responsavel?: boolean;
  t1?: { entrada: string; saida: string; efetivo_min: number };
  break_min?: number;
  t2?: { entrada: string; saida: string; cruza_meia_noite?: boolean; efetivo_min: number };
  jornada_dia_min?: number;
  cobre_almoco?: boolean;
  cobre_jantar?: boolean;
  obs?: string;
}

interface VagaPlanejada {
  id_vaga?: string;
  tipo: string;
  papel?: "abridor" | "fechador" | "intermediario" | "outro";
  responsavel?: boolean;
  folgas: string[]; // ["SEG", ...]
  horario_padrao: {
    t1?: { entrada: string; saida: string; efetivo_min?: number };
    break_min?: number;
    t2?: { entrada: string; saida: string; cruza_meia_noite?: boolean; efetivo_min?: number };
  };
}

interface EscalaResponse {
  setor: string;
  semana_inicio: string;
  modelo_folga: string;
  dias_folga_sugeridos?: string[];
  justificativa_folga?: string;
  dias: Record<string, {
    tipo_dia: string;
    fechamento: string;
    pop_almoco: number;
    pop_jantar: number;
    pop_almoco_coberto: number;
    pop_jantar_coberto: number;
    pops_atendidos: boolean;
    slots: SlotResponse[];
    extras?: SlotResponse[];
  }>;
  plano_folgas?: {
    headcount_total: number;
    demanda_pessoa_dia_semana?: number;
    dias_uteis_por_pessoa?: number;
    demanda_por_dia?: Record<string, number>;
    minimos_por_papel?: { abridor?: number; fechador?: number; intermediario?: number };
    minimos_por_papel_calc?: { abridor: number; fechador: number; intermediario: number };
    cobertura_por_dia?: Record<string, { abridor_em_campo?: number; fechador_em_campo?: number; intermediario_em_campo?: number; headcount_total?: number }>;
    cobertura_por_dia_calc?: Record<string, { abridor: number; fechador: number; intermediario: number; outro: number; headcount_total: number }>;
    headcount_max?: number;
    headcount_usado?: number;
    modelo_folga_aplicado?: string;
    alertas_capacidade?: string[];
    cobertura_almoco_por_dia?: Record<string, { necessario: number; em_campo: number; ok: boolean }>;
    vagas: VagaPlanejada[];
  };
  resumo_semanal?: any;
  validacao?: { aprovado: boolean; alertas_clt?: string[]; alertas_pop?: string[]; alertas_folga?: string[]; alertas_operacionais?: string[] };
}

function formatSlot(s: SlotResponse): string {
  const t1 = s.t1 ? `${s.t1.entrada}–${s.t1.saida}` : "—";
  const t2 = s.t2 ? `${s.t2.entrada}–${s.t2.saida}` : "—";
  return s.t1 && s.t2 ? `T1 ${t1}  •  T2 ${t2}` : s.t2 ? `T2 ${t2}` : t1;
}

export function GeradorEscalaIA() {
  const { effectiveUnidadeId } = useUnidade();
  const [setor, setSetor] = useState<string>("");
  const [semana, setSemana] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<EscalaResponse | null>(null);
  const [modeloFolga, setModeloFolga] = useState<"5x2" | "6x1">("6x1");

  const { data: turnoConfigs } = useQuery({
    queryKey: ["turno_config", effectiveUnidadeId],
    enabled: !!effectiveUnidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turno_config")
        .select("id, setor, modelo_folga, qtd_abridores, qtd_fechadores, qtd_intermediarios, observacoes")
        .eq("unidade_id", effectiveUnidadeId!)
        .order("setor");
      if (error) throw error;
      return (data ?? []) as TurnoConfigRow[];
    },
  });

  const { data: escalaMinimas } = useQuery({
    queryKey: ["escala_minima", effectiveUnidadeId, setor],
    enabled: !!effectiveUnidadeId && !!setor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escala_minima")
        .select("setor, dia_semana, turno, qtd_efetivos, qtd_extras")
        .eq("unidade_id", effectiveUnidadeId!)
        .eq("setor", setor);
      if (error) throw error;
      return (data ?? []) as EscalaMinimaRow[];
    },
  });

  const config = useMemo(
    () => turnoConfigs?.find((t) => t.setor === setor) ?? null,
    [turnoConfigs, setor],
  );

  // Quando o setor muda, sincronizar o modelo de folga com o padrão do setor
  // (mas o usuário pode sobrescrever depois).
  const lastSyncedSetor = useRef<string>("");
  if (setor && config && lastSyncedSetor.current !== setor) {
    lastSyncedSetor.current = setor;
    if (config.modelo_folga === "5x2" || config.modelo_folga === "6x1") {
      queueMicrotask(() => setModeloFolga(config.modelo_folga as "5x2" | "6x1"));
    }
  }

  const tabelaMinima = useMemo(() => {
    if (!escalaMinimas) return [];
    return DIAS.map((dia) => {
      const al = escalaMinimas.find((r) => r.dia_semana === dia && (r.turno === "ALMOCO" || r.turno === "TARDE"));
      const ja = escalaMinimas.find((r) => r.dia_semana === dia && r.turno === "JANTAR");
      return {
        dia,
        almoco_efetivos: al?.qtd_efetivos ?? 0,
        almoco_extras: al?.qtd_extras ?? 0,
        jantar_efetivos: ja?.qtd_efetivos ?? 0,
        jantar_extras: ja?.qtd_extras ?? 0,
      };
    });
  }, [escalaMinimas]);

  const [templateId, setTemplateId] = useState<string | null>(null);

  const handleGerar = async () => {
    if (!config || !effectiveUnidadeId) {
      toast.error("Selecione uma unidade e um setor com configuração de turnos");
      return;
    }
    setLoading(true);
    setResultado(null);
    setTemplateId(null);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-escala-ia", {
        body: {
          setor,
          semana_inicio: semana,
          unidade_id: effectiveUnidadeId,
          modelo_folga: modeloFolga,
        },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.escala) setResultado(data.escala as EscalaResponse);
        throw new Error(data.error + (data.alertas?.length ? `: ${data.alertas.join("; ")}` : ""));
      }
      setResultado(data.escala as EscalaResponse);
      setTemplateId(data.template_id ?? null);
      toast.success("Escala gerada e salva como pendente de aprovação");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha ao gerar escala");
    } finally {
      setLoading(false);
    }
  };

  const copyJSON = () => {
    if (!resultado) return;
    navigator.clipboard.writeText(JSON.stringify(resultado, null, 2));
    toast.success("JSON copiado");
  };

  const [enviando, setEnviando] = useState(false);

  const enviarParaEditor = async () => {
    if (!resultado || !effectiveUnidadeId) return;
    setEnviando(true);
    try {
      // Semana sempre normalizada para a segunda-feira (Editor faz startOfWeek).
      const weekStartMonday = toMondayISO(semana);

      // 1) Resolver sector_id pelo nome do setor (turno_config.setor → sectors.name)
      const { data: sectorRows, error: sectorErr } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("unit_id", effectiveUnidadeId);
      if (sectorErr) throw sectorErr;

      const normalize = (s: string) =>
        s
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .toLowerCase().trim()
          .replace(/[\s\-_]+/g, " ");
      // Lemma: colapsa singular/plural e variações m↔n no final (cumins/cumim → cumin)
      const lemma = (s: string) =>
        normalize(s).replace(/m$/, "n").replace(/s$/, "");
      const target = normalize(setor);
      const targetLemma = lemma(setor);
      const rows = sectorRows || [];

      // 1) Match exato normalizado (vence sempre, mesmo se houver variantes)
      let sector = rows.find((s) => normalize(s.name) === target);
      // 2) Match por lemma — quando há múltiplos, escolhe o de nome mais curto
      //    (tende a ser a forma canônica: "Cumin" vence "CUMINS NAZO")
      if (!sector) {
        const lemmaMatches = rows.filter((s) => lemma(s.name) === targetLemma);
        if (lemmaMatches.length >= 1) {
          sector = [...lemmaMatches].sort((a, b) => a.name.length - b.name.length)[0];
        }
      }
      // 3) Fallback: startsWith pelo lemma — mesma regra: menor nome vence
      if (!sector) {
        const startsMatches = rows.filter((s) => lemma(s.name).startsWith(targetLemma));
        if (startsMatches.length >= 1) {
          sector = [...startsMatches].sort((a, b) => a.name.length - b.name.length)[0];
        }
      }
      if (!sector) {
        const candidatos = rows.map((s) => s.name).join(", ") || "nenhum";
        toast.error(
          `Setor "${setor}" não encontrado no Editor de Escalas. Setores da unidade: ${candidatos}.`,
          { duration: 10000 },
        );
        return;
      }

      // 2) Construir mapa dia da semana (SEG..DOM) → date string da semana (a partir da segunda)
      const baseMonday = new Date(`${weekStartMonday}T12:00:00`);
      const dayDates: Record<string, string> = {};
      DIAS.forEach((d, idx) => {
        const dt = new Date(baseMonday);
        dt.setDate(baseMonday.getDate() + idx);
        dayDates[d] = dt.toISOString().slice(0, 10);
      });

      const isHHMM = (s: any): s is string =>
        typeof s === "string" && /^\d{1,2}:\d{2}$/.test(s.trim());

      const slotToDay = (horario: any): DraftDay | null => {
        if (!horario || typeof horario !== "object") return null;
        // Formato canônico: { t1: { entrada, saida }, t2: { entrada, saida } }
        if (horario.t1 && horario.t2 && isHHMM(horario.t1.entrada) && isHHMM(horario.t2.saida)) {
          return {
            kind: "work",
            start_time: horario.t1.entrada,
            end_time: horario.t2.saida,
            break_min: 180,
            shift_type: "T3",
          };
        }
        const t = horario.t1 ?? horario.t2;
        if (t && isHHMM(t.entrada) && isHHMM(t.saida)) {
          return {
            kind: "work",
            start_time: t.entrada,
            end_time: t.saida,
            break_min: 180,
            shift_type: horario.t1 ? "T1" : "T2",
          };
        }
        // Fallback: { entrada, saida } no próprio objeto
        if (isHHMM(horario.entrada) && isHHMM(horario.saida)) {
          return {
            kind: "work",
            start_time: horario.entrada,
            end_time: horario.saida,
            break_min: 180,
            shift_type: "T1",
          };
        }
        // Fallback: { start_time, end_time } / { inicio, fim }
        const start = horario.start_time ?? horario.inicio;
        const end = horario.end_time ?? horario.fim;
        if (isHHMM(start) && isHHMM(end)) {
          return {
            kind: "work",
            start_time: start,
            end_time: end,
            break_min: 180,
            shift_type: "T1",
          };
        }
        return null;
      };

      // ===== Nova estratégia: usar plano_folgas.vagas (folgas distribuídas por vaga) =====
      const vagas = resultado.plano_folgas?.vagas ?? [];
      if (vagas.length === 0) {
        toast.error("IA não retornou plano_folgas.vagas. Re-gere a escala.");
        return;
      }

      const drafts: Omit<DraftSlot, "id" | "created_at" | "created_by">[] = [];
      let vagasIgnoradas = 0;
      let warnedSample = false;
      for (let i = 0; i < vagas.length; i++) {
        const v = vagas[i];
        const horario = (v as any)?.horario_padrao ?? (v as any)?.horario ?? v;
        const day = slotToDay(horario);
        if (!day) {
          vagasIgnoradas++;
          if (!warnedSample) {
            warnedSample = true;
            console.warn("[GeradorEscalaIA] vaga sem horário válido:", {
              keys: v && typeof v === "object" ? Object.keys(v) : null,
              horario_padrao: v?.horario_padrao,
            });
          }
          continue;
        }
        const folgasSet = new Set(v.folgas ?? []);
        const days: Record<string, DraftDay> = {};
        for (const d of DIAS) {
          days[dayDates[d]] = folgasSet.has(d) ? { kind: "off" } : day;
        }
        drafts.push({
          unit_id: effectiveUnidadeId,
          sector_id: sector.id,
          sector_name: sector.name,
          week_start: weekStartMonday,
          label: `Vaga ${v.tipo ?? "?"}${v.responsavel ? " ★" : ""}`,
          tipo: v.tipo ?? "indefinido",
          responsavel: !!v.responsavel,
          days,
        });
      }

      if (drafts.length === 0) {
        toast.error(
          vagasIgnoradas > 0
            ? `IA não retornou horários válidos em ${vagasIgnoradas} vaga(s). Tente regenerar a escala.`
            : "Nenhuma vaga válida para enviar.",
        );
        return;
      }
      if (vagasIgnoradas > 0) {
        toast.warning(`${vagasIgnoradas} vaga(s) ignorada(s) por horário inválido.`);
      }

      console.info("[AI Draft] enviando para editor:", {
        unit_id: effectiveUnidadeId,
        sector: sector.name,
        sector_id: sector.id,
        week_start: weekStartMonday,
        vagas: vagas.length,
      });

      const { inserted } = await insertDraftSlots(drafts);

      const fireDrafts = () =>
        window.dispatchEvent(
          new CustomEvent("ai-drafts-ready", {
            detail: { unitId: effectiveUnidadeId, sectorId: sector.id, weekStart: weekStartMonday },
          }),
        );

      toast.success(
        `${inserted} vaga(s) enviadas para "${sector.name}" — semana de ${weekStartMonday}`,
        {
          action: { label: "Abrir Editor agora", onClick: fireDrafts },
          duration: 8000,
        },
      );

      // 5) Navegar para o Editor (Gestão de Pessoas → Escalas → Editor)
      fireDrafts();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Falha ao enviar para o Editor");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerador de Escalas com IA
          </CardTitle>
          <CardDescription>
            Gera o template de horários (T1/T2/break) por setor cobrindo POP almoço e jantar,
            respeitando regras CLT e a estrutura aprovada pelo COO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {turnoConfigs?.map((t) => (
                    <SelectItem key={t.id} value={t.setor}>{t.setor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Semana (segunda-feira)</Label>
              <Input type="date" value={semana} onChange={(e) => setSemana(e.target.value ? toMondayISO(e.target.value) : e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Modelo de folga</Label>
              <Select value={modeloFolga} onValueChange={(v) => setModeloFolga(v as "5x2" | "6x1")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6x1">6x1 (1 folga/semana)</SelectItem>
                  <SelectItem value="5x2">5x2 (2 folgas/semana)</SelectItem>
                </SelectContent>
              </Select>
              {config?.modelo_folga && config.modelo_folga !== modeloFolga && (
                <p className="text-xs text-muted-foreground">Padrão do setor: {config.modelo_folga}</p>
              )}
            </div>
          </div>

          {config && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Abridores: {config.qtd_abridores}</Badge>
                <Badge variant="outline">Fechadores: {config.qtd_fechadores}</Badge>
                <Badge variant="outline">Intermediários: {config.qtd_intermediarios}</Badge>
                <Badge>Total: {config.qtd_abridores + config.qtd_fechadores + config.qtd_intermediarios}</Badge>
              </div>
              {config.observacoes && (
                <p className="text-muted-foreground text-xs pt-1">{config.observacoes}</p>
              )}
            </div>
          )}

          {tabelaMinima.length > 0 && setor && (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead>POP Almoço</TableHead>
                    <TableHead>POP Jantar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tabelaMinima.map((d) => (
                    <TableRow key={d.dia}>
                      <TableCell className="font-medium">{d.dia}</TableCell>
                      <TableCell>
                        {d.almoco_efetivos}{d.almoco_extras > 0 ? ` + ${d.almoco_extras} extra` : ""}
                      </TableCell>
                      <TableCell>
                        {d.jantar_efetivos}{d.jantar_extras > 0 ? ` + ${d.jantar_extras} extra` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Button onClick={handleGerar} disabled={!setor || !config || loading} className="w-full md:w-auto">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…</> : <><Sparkles className="mr-2 h-4 w-4" /> Gerar escala com IA</>}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                {resultado.validacao?.aprovado ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                Resultado — {resultado.setor}
              </CardTitle>
              <CardDescription>
                Semana {resultado.semana_inicio} • {resultado.modelo_folga}
                {templateId ? ` • salvo (pendente aprovação)` : ""}
                {resultado.dias_folga_sugeridos?.length ? ` • Folga sugerida: ${resultado.dias_folga_sugeridos.join(", ")}` : ""}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={enviarParaEditor} disabled={enviando}>
                  {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  Enviar para o Editor de Escalas
                </Button>
                <Button variant="outline" size="sm" onClick={copyJSON}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar JSON
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground max-w-xs text-right">
                As vagas aparecem como linhas <strong>"Vaga Aberta"</strong> no Editor. Vincule cada uma a uma pessoa ativa para gravar a escala.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {resultado.validacao && (
              <div className="space-y-2">
                {resultado.validacao.alertas_clt?.map((a, i) => (
                  <div key={`clt-${i}`} className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">CLT: {a}</div>
                ))}
                {resultado.validacao.alertas_pop?.map((a, i) => (
                  <div key={`pop-${i}`} className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">POP: {a}</div>
                ))}
                {resultado.validacao.alertas_operacionais?.map((a, i) => (
                  <div key={`op-${i}`} className="rounded border bg-muted px-3 py-2 text-sm">{a}</div>
                ))}
              </div>
            )}
            {resultado.validacao?.alertas_folga && resultado.validacao.alertas_folga.length > 0 && (
              <div className="space-y-2">
                {resultado.validacao.alertas_folga.map((a, i) => (
                  <div key={`folga-${i}`} className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">FOLGA: {a}</div>
                ))}
              </div>
            )}

            {resultado.plano_folgas?.alertas_capacidade && resultado.plano_folgas.alertas_capacidade.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Capacidade do setor
                </div>
                {resultado.plano_folgas.alertas_capacidade.map((a, i) => (
                  <div key={i} className="text-xs text-amber-900 dark:text-amber-200">{a}</div>
                ))}
              </div>
            )}

            {resultado.plano_folgas?.cobertura_almoco_por_dia && (
              <div className="rounded-lg border p-3 text-xs space-y-1">
                <div className="font-semibold text-sm">Cobertura POP Almoço (chega até 11:00)</div>
                <div className="flex flex-wrap gap-2">
                  {DIAS.map((d) => {
                    const c = resultado.plano_folgas!.cobertura_almoco_por_dia![d];
                    if (!c) return null;
                    return (
                      <Badge key={d} variant={c.ok ? "secondary" : "destructive"} className="text-[10px]">
                        {d}: {c.em_campo}/{c.necessario}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {resultado.plano_folgas && resultado.plano_folgas.vagas?.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-semibold text-sm">
                    Plano de folgas — {resultado.plano_folgas.headcount_usado ?? resultado.plano_folgas.headcount_total} vagas
                    {resultado.plano_folgas.headcount_max ? ` / ${resultado.plano_folgas.headcount_max} disponíveis` : ""}
                    {" "}({resultado.plano_folgas.modelo_folga_aplicado ?? resultado.modelo_folga})
                  </div>
                  {resultado.plano_folgas.demanda_por_dia && (
                    <div className="text-xs text-muted-foreground">
                      Demanda: {DIAS.map(d => `${d} ${resultado.plano_folgas!.demanda_por_dia![d] ?? 0}`).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Vaga</TableHead>
                        {DIAS.map(d => <TableHead key={d} className="text-xs text-center">{d}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultado.plano_folgas.vagas.map((v, idx) => {
                        const folgasSet = new Set(v.folgas ?? []);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-medium">
                              {v.tipo}{v.responsavel ? " ★" : ""}
                            </TableCell>
                            {DIAS.map(d => (
                              <TableCell key={d} className="text-xs text-center">
                                {folgasSet.has(d) ? (
                                  <Badge variant="secondary" className="text-[10px]">FOLGA</Badge>
                                ) : (
                                  <span className="text-muted-foreground">✓</span>
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {(() => {
                  const cob = resultado.plano_folgas!.cobertura_por_dia_calc;
                  const min = resultado.plano_folgas!.minimos_por_papel_calc
                    ?? resultado.plano_folgas!.minimos_por_papel
                    ?? { abridor: 0, fechador: 0, intermediario: 0 };
                  if (!cob) return null;
                  const papeis: Array<{ key: "abridor" | "fechador" | "intermediario"; label: string }> = [
                    { key: "abridor", label: "Abridor" },
                    { key: "fechador", label: "Fechador" },
                    { key: "intermediario", label: "Intermediário" },
                  ];
                  return (
                    <div className="overflow-x-auto">
                      <div className="text-xs font-semibold mb-1 text-muted-foreground uppercase">Cobertura por papel (em campo / mínimo)</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Papel</TableHead>
                            {DIAS.map(d => <TableHead key={d} className="text-xs text-center">{d}</TableHead>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {papeis.map(p => (
                            <TableRow key={p.key}>
                              <TableCell className="text-xs font-medium">{p.label} (mín. {min[p.key] ?? 0})</TableCell>
                              {DIAS.map(d => {
                                const emCampo = cob[d]?.[p.key] ?? 0;
                                const minimo = min[p.key] ?? 0;
                                const furou = minimo > 0 && emCampo < minimo;
                                return (
                                  <TableCell key={d} className={`text-xs text-center font-mono ${furou ? "text-destructive font-bold" : ""}`}>
                                    {emCampo}/{minimo}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {DIAS.map((dia) => {
                const d = resultado.dias?.[dia];
                if (!d) {
                  return (
                    <div key={dia} className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                      <div className="font-semibold mb-1">{dia} — folga</div>
                    </div>
                  );
                }
                const ok = d.pops_atendidos;
                return (
                  <div key={dia} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{dia} <span className="text-muted-foreground text-xs">• Tipo {d.tipo_dia} • fecha {d.fechamento}</span></div>
                      <Badge variant={ok ? "default" : "destructive"}>
                        A {d.pop_almoco_coberto}/{d.pop_almoco} • J {d.pop_jantar_coberto}/{d.pop_jantar}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {[...(d.slots ?? []), ...(d.extras ?? [])].map((s, i) => (
                        <div key={i} className="text-xs rounded bg-muted/40 px-2 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {s.quantidade}× {s.tipo}
                              {s.responsavel ? " ★" : ""}
                            </span>
                            <span className="text-muted-foreground">{formatSlot(s)}</span>
                          </div>
                          {s.obs && <div className="text-muted-foreground mt-0.5">{s.obs}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
