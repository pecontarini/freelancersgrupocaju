import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMissoes, type MissaoPrioridade, type MissaoStatus } from "@/hooks/useMissoes";
import { useUnidadeMembros } from "@/hooks/useUnidadeMembros";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { STATUS_ORDER } from "../shared/Badges";

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function defaultPrazoFor(p: MissaoPrioridade): string {
  if (p === "alta") return addDaysISO(3);
  if (p === "baixa") return addDaysISO(14);
  return addDaysISO(7);
}

export function NovaMissaoDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { effectiveUnidadeId } = useUnidade();
  const { create } = useMissoes({ unidadeId: effectiveUnidadeId });
  const { data: membros = [] } = useUnidadeMembros(effectiveUnidadeId);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [topico, setTopico] = useState("");
  const [prioridade, setPrioridade] = useState<MissaoPrioridade>("media");
  const [status, setStatus] = useState<MissaoStatus>("a_fazer");
  const [prazo, setPrazo] = useState<string>(defaultPrazoFor("media"));
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [coRespIds, setCoRespIds] = useState<string[]>([]);
  const [tarefas, setTarefas] = useState<string[]>([]);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTitulo("");
      setDescricao("");
      setTopico("");
      setPrioridade("media");
      setStatus("a_fazer");
      setPrazo(defaultPrazoFor("media"));
      setResponsavelId(user?.id ?? "");
      setCoRespIds([]);
      setTarefas([]);
      setNovaTarefa("");
    }
  }, [open, user?.id]);

  // Auto-update prazo se usuário não editou ainda (heurística simples: bate com defaults)
  useEffect(() => {
    setPrazo((curr) => {
      const matchesAnyDefault =
        curr === addDaysISO(3) || curr === addDaysISO(7) || curr === addDaysISO(14);
      return matchesAnyDefault ? defaultPrazoFor(prioridade) : curr;
    });
  }, [prioridade]);

  const membrosCoResp = useMemo(
    () => membros.filter((m) => m.user_id !== responsavelId && !coRespIds.includes(m.user_id)),
    [membros, responsavelId, coRespIds],
  );

  function addTarefa() {
    const t = novaTarefa.trim();
    if (!t) return;
    setTarefas((prev) => [...prev, t]);
    setNovaTarefa("");
  }

  async function handleSubmit() {
    if (!titulo.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setSubmitting(true);
    try {
      const membrosPayload = [
        ...(responsavelId ? [{ user_id: responsavelId, papel: "responsavel" as const }] : []),
        ...coRespIds.map((id) => ({ user_id: id, papel: "co_responsavel" as const })),
      ];
      const desc = topico.trim()
        ? `[${topico.trim()}] ${descricao.trim()}`.trim()
        : descricao.trim();
      await create.mutateAsync({
        titulo: titulo.trim(),
        descricao: desc || null,
        prioridade,
        status,
        prazo: prazo || null,
        unidade_id: effectiveUnidadeId,
        membros: membrosPayload,
        tarefas: tarefas.map((d, i) => ({ descricao: d, ordem: i })),
      });
      toast.success("Missão criada.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar missão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova missão</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Título *</label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Reduzir CMV de proteínas"
              className="mt-1 uppercase"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Contexto, objetivo, observações..."
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tópico</label>
              <Input
                value={topico}
                onChange={(e) => setTopico(e.target.value)}
                placeholder="Ex: CMV, Manutenção, NPS"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prazo</label>
              <Input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as MissaoPrioridade)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status inicial</label>
              <Select value={status} onValueChange={(v) => setStatus(v as MissaoStatus)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.filter((s) => s !== "concluido").map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Responsável</label>
            {membros.length === 0 ? (
              <div className="mt-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Nenhum membro vinculado a esta unidade. Vincule pessoas no painel admin antes de criar missões.
              </div>
            ) : (
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar responsável" />
                </SelectTrigger>
                <SelectContent>
                  {membros.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.nome}
                      {m.cargo ? ` · ${m.cargo}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Co-responsáveis</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {coRespIds.map((id) => {
                const m = membros.find((x) => x.user_id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs"
                  >
                    {m?.nome ?? "—"}
                    <button
                      onClick={() => setCoRespIds((prev) => prev.filter((x) => x !== id))}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              {membrosCoResp.length > 0 && (
                <Select
                  value=""
                  onValueChange={(v) => v && setCoRespIds((prev) => [...prev, v])}
                >
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue placeholder="+ adicionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {membrosCoResp.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Plano de ação ({tarefas.length})
            </label>
            <ul className="mt-1 space-y-1.5">
              {tarefas.map((t, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-border/40 bg-card/40 px-2 py-1.5 text-sm"
                >
                  <span className="flex-1">{t}</span>
                  <button
                    onClick={() => setTarefas((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input
                value={novaTarefa}
                onChange={(e) => setNovaTarefa(e.target.value)}
                placeholder="Nova tarefa do plano de ação..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTarefa();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTarefa}>
                <Plus className="mr-1 h-3 w-3" /> Adicionar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !titulo.trim()}>
            {submitting ? "Criando..." : "Criar missão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
