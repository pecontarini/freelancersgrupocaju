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
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;

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
  resumo_semanal?: any;
  validacao?: { aprovado: boolean; alertas_clt?: string[]; alertas_pop?: string[]; alertas_operacionais?: string[] };
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
  const lastSyncedSetor = React.useRef<string>("");
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
              <Input type="date" value={semana} onChange={(e) => setSemana(e.target.value)} />
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
            <Button variant="outline" size="sm" onClick={copyJSON}>
              <Copy className="mr-2 h-4 w-4" /> Copiar JSON
            </Button>
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
