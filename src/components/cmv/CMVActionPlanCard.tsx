import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Sparkles, Calendar, AlertTriangle, Plus, X, Loader2, Check } from "lucide-react";
import { useMissoes, type MissaoPrioridade } from "@/hooks/useMissoes";
import { useUnidadeMembros } from "@/hooks/useUnidadeMembros";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProposedActionPlan {
  titulo: string;
  descricao: string;
  prioridade: MissaoPrioridade;
  prazo_dias: number;
  tarefas: string[];
  item_relacionado: string;
  turno_critico?: string;
}

interface Props {
  plan: ProposedActionPlan;
  unitId: string;
  onCreated?: () => void;
  onDismiss?: () => void;
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const PRIORITY_BADGE: Record<MissaoPrioridade, string> = {
  alta: "bg-destructive/15 text-destructive border-destructive/30",
  media: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  baixa: "bg-muted text-muted-foreground border-border",
};

export function CMVActionPlanCard({ plan, unitId, onCreated, onDismiss }: Props) {
  const { user } = useAuth();
  const { create } = useMissoes();
  const { data: membros = [] } = useUnidadeMembros(unitId, { includeAdmins: true });

  const [titulo, setTitulo] = useState(plan.titulo);
  const [descricao, setDescricao] = useState(plan.descricao);
  const [prioridade, setPrioridade] = useState<MissaoPrioridade>(plan.prioridade);
  const [prazoDias, setPrazoDias] = useState(plan.prazo_dias);
  const [tarefas, setTarefas] = useState<string[]>(plan.tarefas);
  const [responsavelId, setResponsavelId] = useState<string>(user?.id ?? "");
  const [created, setCreated] = useState(false);

  const updateTarefa = (i: number, v: string) => {
    setTarefas((prev) => prev.map((t, idx) => (idx === i ? v : t)));
  };
  const removeTarefa = (i: number) => {
    setTarefas((prev) => prev.filter((_, idx) => idx !== i));
  };
  const addTarefa = () => {
    setTarefas((prev) => [...prev, ""]);
  };

  const handleCreate = async () => {
    const cleanTarefas = tarefas.map((t) => t.trim()).filter(Boolean);
    if (!titulo.trim()) {
      toast.error("Informe um título para a missão.");
      return;
    }
    if (cleanTarefas.length === 0) {
      toast.error("Adicione ao menos uma tarefa.");
      return;
    }

    try {
      await create.mutateAsync({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        prioridade,
        prazo: addDaysISO(prazoDias),
        unidade_id: unitId,
        membros: responsavelId
          ? [{ user_id: responsavelId, papel: "responsavel" }]
          : [],
        tarefas: cleanTarefas.map((descr, i) => ({ descricao: descr, ordem: i })),
      });
      setCreated(true);
      toast.success("Missão criada na Agenda do Líder!");
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar missão.");
    }
  };

  if (created) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
            <Check className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-medium">Missão enviada para a Agenda do Líder</p>
            <p className="text-sm text-muted-foreground">"{titulo}" — prazo em {prazoDias} dia(s).</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base uppercase tracking-wide">Plano de Ação Sugerido</CardTitle>
          </div>
          {onDismiss && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="outline" className={PRIORITY_BADGE[prioridade]}>
            {prioridade === "alta" && <AlertTriangle className="h-3 w-3 mr-1" />}
            Prioridade {prioridade}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ListChecks className="h-3 w-3" /> {plan.item_relacionado}
          </Badge>
          {plan.turno_critico && (
            <Badge variant="outline" className="gap-1">
              <Calendar className="h-3 w-3" /> {plan.turno_critico}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="ap-titulo">Título</Label>
          <Input id="ap-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ap-desc">Descrição</Label>
          <Textarea id="ap-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as MissaoPrioridade)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ap-prazo">Prazo (dias)</Label>
            <Input
              id="ap-prazo"
              type="number"
              min={1}
              max={30}
              value={prazoDias}
              onChange={(e) => setPrazoDias(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            />
          </div>
        </div>

        <div>
          <Label>Responsável</Label>
          <Select value={responsavelId} onValueChange={setResponsavelId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um responsável" />
            </SelectTrigger>
            <SelectContent>
              {membros.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.nome}
                  {m.cargo ? ` — ${m.cargo}` : ""}
                </SelectItem>
              ))}
              {membros.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  Sem membros vinculados a esta unidade.
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Tarefas</Label>
            <Button variant="ghost" size="sm" onClick={addTarefa} className="h-7 gap-1">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {tarefas.map((t, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2 text-xs font-mono text-muted-foreground w-4 text-right">{i + 1}.</span>
                <Textarea
                  value={t}
                  onChange={(e) => updateTarefa(i, e.target.value)}
                  rows={1}
                  className="min-h-[36px] resize-none"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5" onClick={() => removeTarefa(i)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button onClick={handleCreate} disabled={create.isPending} className="flex-1">
            {create.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando missão...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" /> Criar Missão na Agenda do Líder
              </>
            )}
          </Button>
          {onDismiss && (
            <Button variant="outline" onClick={onDismiss}>
              Descartar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
