import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Clock, Sparkles, CheckCircle2, XCircle, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const UNIDADE_ID_ITAIM = "87228077-03ab-445b-a409-237972ee6719";

const SETORES = [
  "COZINHA", "BAR", "GARÇOM", "CUMIN", "PARRILLA",
  "HOSTESS", "DELIVERY", "SUBCHEFE SALÃO", "ASG", "PRODUÇÃO",
] as const;

function nextMonday(from = new Date()): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 1 ? 7 : ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function EscalasItaimSection() {
  const [setorAtivo, setSetorAtivo] = useState<string>("COZINHA");
  const [semanaInicio, setSemanaInicio] = useState<Date>(() => nextMonday());
  const [gerando, setGerando] = useState(false);

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
        .select("id, status, comentario_rejeicao, gerado_em")
        .eq("unidade_id", UNIDADE_ID_ITAIM)
        .eq("setor", setorAtivo)
        .eq("semana_inicio", semanaIso)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const moveSemana = (delta: number) => {
    const d = new Date(semanaInicio);
    d.setDate(d.getDate() + delta * 7);
    setSemanaInicio(d);
  };

  const gerar = async () => {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-escala-ia", {
        body: { setor: setorAtivo, semana_inicio: semanaIso, unidade_id: UNIDADE_ID_ITAIM },
      });
      if (error) throw error;
      if (data?.error && !data?.template_id) throw new Error(data.error);
      toast.success("Escala gerada — aguardando aprovação do COO");
      await refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar escala");
    } finally {
      setGerando(false);
    }
  };

  const renderStatus = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      );
    }

    if (!template) {
      return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="h-4 w-4" />
            Nenhuma escala gerada para {setorAtivo} nesta semana.
          </div>
          <Button
            onClick={gerar}
            disabled={gerando}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar escala com IA
          </Button>
        </div>
      );
    }

    if (template.status === "pendente_aprovacao") {
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20">
          <Clock className="h-3.5 w-3.5 mr-1" /> Aguardando aprovação do COO
        </Badge>
      );
    }

    if (template.status === "aprovado") {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovado
          </Badge>
          <Button variant="outline" size="sm">
            <Link2 className="mr-2 h-4 w-4" /> Vincular funcionários
          </Button>
        </div>
      );
    }

    if (template.status === "rejeitado") {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="destructive">
              <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitado
            </Badge>
            <Button onClick={gerar} disabled={gerando} variant="outline" size="sm">
              {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Regerar
            </Button>
          </div>
          {template.comentario_rejeicao && (
            <p className="text-sm text-muted-foreground italic">"{template.comentario_rejeicao}"</p>
          )}
        </div>
      );
    }

    return <Badge variant="outline">{template.status}</Badge>;
  };

  return (
    <section className="space-y-4 pt-2">
      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Badge className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20">
          MVP · Caju Limão Itaim
        </Badge>
        <h2 className="text-xl font-semibold tracking-tight">Gerador de Escalas</h2>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-2 min-w-max pb-1">
          {SETORES.map((s) => {
            const ativo = s === setorAtivo;
            return (
              <button
                key={s}
                onClick={() => setSetorAtivo(s)}
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
