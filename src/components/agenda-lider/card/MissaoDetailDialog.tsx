import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMissoes, type Missao, type MissaoPrioridade, type MissaoStatus } from "@/hooks/useMissoes";
import { useMissaoDetalhe } from "@/hooks/useMissaoDetalhe";
import { useUnidadeMembros } from "@/hooks/useUnidadeMembros";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { PrioridadeBadge, StatusBadge, STATUS_ORDER } from "../shared/Badges";
import { supabase } from "@/integrations/supabase/client";

export function MissaoDetailDialog({
  missaoId,
  open,
  onClose,
}: {
  missaoId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { effectiveUnidadeId } = useUnidade();
  const { data: missoes = [], update, remove } = useMissoes({ unidadeId: effectiveUnidadeId });
  const missao = missoes.find((m) => m.id === missaoId) ?? null;

  const detalhe = useMissaoDetalhe(missaoId);
  const { data: membros = [] } = useUnidadeMembros(effectiveUnidadeId);
  const profilesById = useMemo(
    () => new Map(membros.map((m) => [m.user_id, m])),
    [membros],
  );

  const [editing, setEditing] = useState(false);
  const [formTitulo, setFormTitulo] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrioridade, setFormPrioridade] = useState<MissaoPrioridade>("media");
  const [formStatus, setFormStatus] = useState<MissaoStatus>("a_fazer");
  const [formPrazo, setFormPrazo] = useState("");

  const [novaTarefa, setNovaTarefa] = useState("");
  const [novoComentario, setNovoComentario] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  useEffect(() => {
    if (missao) {
      setFormTitulo(missao.titulo);
      setFormDesc(missao.descricao ?? "");
      setFormPrioridade(missao.prioridade);
      setFormStatus(missao.status);
      setFormPrazo(missao.prazo ?? "");
      setEditing(false);
    }
  }, [missao]);

  if (!missao) return null;

  const responsavel = detalhe.membros.find((m) => m.papel === "responsavel");
  const coResponsaveis = detalhe.membros.filter((m) => m.papel === "co_responsavel");
  const membrosIds = new Set(detalhe.membros.map((m) => m.user_id));
  const membrosDisponiveis = membros.filter(
    (m) =>
      !membrosIds.has(m.user_id) &&
      (mentionQuery.trim() === "" ||
        m.nome.toLowerCase().includes(mentionQuery.toLowerCase())),
  );

  async function handleSave() {
    try {
      await update.mutateAsync({
        id: missao.id,
        titulo: formTitulo,
        descricao: formDesc || null,
        prioridade: formPrioridade,
        status: formStatus,
        prazo: formPrazo || null,
      });
      setEditing(false);
      toast.success("Missão atualizada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao atualizar.");
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir esta missão? A ação não pode ser desfeita.")) return;
    try {
      await remove.mutateAsync(missao.id);
      toast.success("Missão excluída.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <PrioridadeBadge prioridade={missao.prioridade} />
              <StatusBadge status={missao.status} />
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogTitle className="mt-2">
            {editing ? (
              <Input value={formTitulo} onChange={(e) => setFormTitulo(e.target.value)} className="text-base font-semibold" />
            ) : (
              <span className="text-lg">{missao.titulo}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-2">
          <TabsList>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="checklist">
              Plano de ação ({detalhe.tarefas.length})
            </TabsTrigger>
            <TabsTrigger value="comentarios">
              Comentários ({detalhe.comentarios.length})
            </TabsTrigger>
            <TabsTrigger value="anexos">Anexos ({detalhe.anexos.length})</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 pt-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              {editing ? (
                <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={3} className="mt-1" />
              ) : (
                <p className="mt-1 text-sm text-foreground/90">
                  {missao.descricao || <span className="text-muted-foreground">Sem descrição</span>}
                </p>
              )}
            </div>

            {editing && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                  <Select value={formPrioridade} onValueChange={(v) => setFormPrioridade(v as MissaoPrioridade)}>
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
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={formStatus} onValueChange={(v) => setFormStatus(v as MissaoStatus)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Prazo</label>
                  <Input type="date" value={formPrazo} onChange={(e) => setFormPrazo(e.target.value)} className="mt-1" />
                </div>
              </div>
            )}

            {/* Responsáveis */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Responsável</label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {responsavel ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                    {profilesById.get(responsavel.user_id)?.nome ?? "—"}
                    <button
                      onClick={() => detalhe.removeMembro.mutate({ user_id: responsavel.user_id })}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Nenhum responsável definido</span>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Co-responsáveis</label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {coResponsaveis.map((c) => (
                  <span key={c.user_id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
                    {profilesById.get(c.user_id)?.nome ?? "—"}
                    <button
                      onClick={() => detalhe.removeMembro.mutate({ user_id: c.user_id })}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {!mentionOpen ? (
                  <Button size="sm" variant="outline" onClick={() => setMentionOpen(true)}>
                    <UserPlus className="mr-1 h-3 w-3" /> @ adicionar
                  </Button>
                ) : (
                  <div className="relative">
                    <Input
                      autoFocus
                      placeholder="Buscar pessoa..."
                      value={mentionQuery}
                      onChange={(e) => setMentionQuery(e.target.value)}
                      onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
                      className="h-8 w-52"
                    />
                    {membrosDisponiveis.length > 0 && (
                      <div className="absolute z-50 mt-1 max-h-60 w-64 overflow-auto rounded-md border bg-popover p-1 shadow-md">
                        {membrosDisponiveis.slice(0, 8).map((m) => (
                          <button
                            key={m.user_id}
                            onMouseDown={async () => {
                              const papel = responsavel ? "co_responsavel" : "responsavel";
                              try {
                                await detalhe.addMembro.mutateAsync({ user_id: m.user_id, papel });
                                toast.success(`${m.nome} adicionado.`);
                                setMentionQuery("");
                                setMentionOpen(false);
                              } catch (e: any) {
                                toast.error(e?.message ?? "Falha.");
                              }
                            }}
                            className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                          >
                            <span className="font-medium">{m.nome}</span>
                            {m.cargo && (
                              <span className="text-[10px] text-muted-foreground">{m.cargo}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border/40 pt-3">
              {editing ? (
                <>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>Salvar</Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Editar
                </Button>
              )}
            </div>
          </TabsContent>

          {/* CHECKLIST */}
          <TabsContent value="checklist" className="space-y-3 pt-3">
            <ul className="space-y-2">
              {detalhe.tarefas.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-2 rounded-md border border-border/40 bg-card/50 p-2"
                >
                  <Checkbox
                    checked={t.concluido}
                    onCheckedChange={(v) =>
                      detalhe.toggleTarefa.mutate({ id: t.id, concluido: !!v })
                    }
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${t.concluido ? "text-muted-foreground line-through" : "text-foreground"}`}
                    >
                      {t.descricao}
                    </p>
                    {t.dia_semana && (
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(t.dia_semana + "T00:00:00").toLocaleDateString("pt-BR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => detalhe.removeTarefa.mutate(t.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
              {detalhe.tarefas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa ainda.</p>
              )}
            </ul>

            <div className="flex gap-2">
              <Input
                placeholder="Nova tarefa..."
                value={novaTarefa}
                onChange={(e) => setNovaTarefa(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && novaTarefa.trim()) {
                    detalhe.addTarefa.mutate({ descricao: novaTarefa.trim() });
                    setNovaTarefa("");
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (!novaTarefa.trim()) return;
                  detalhe.addTarefa.mutate({ descricao: novaTarefa.trim() });
                  setNovaTarefa("");
                }}
              >
                Adicionar
              </Button>
            </div>
          </TabsContent>

          {/* COMENTÁRIOS */}
          <TabsContent value="comentarios" className="space-y-3 pt-3">
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {detalhe.comentarios.map((c) => (
                <div key={c.id} className="rounded-md border border-border/40 bg-card/50 p-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-medium">
                      {profilesById.get(c.user_id)?.nome ?? "Usuário"}
                    </span>
                    <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.texto}</p>
                </div>
              ))}
              {detalhe.comentarios.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem comentários.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Adicionar comentário..."
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                rows={2}
              />
              <Button
                onClick={async () => {
                  if (!novoComentario.trim()) return;
                  await detalhe.addComentario.mutateAsync(novoComentario.trim());
                  setNovoComentario("");
                }}
              >
                Enviar
              </Button>
            </div>
          </TabsContent>

          {/* ANEXOS */}
          <TabsContent value="anexos" className="space-y-3 pt-3">
            <div className="space-y-2">
              {detalhe.anexos.map((a) => (
                <a
                  key={a.id}
                  href={a.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-md border border-border/40 bg-card/50 p-2 text-sm hover:bg-muted/30"
                >
                  <span className="truncate">{a.file_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </a>
              ))}
              {detalhe.anexos.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
              )}
            </div>
            <div>
              <input
                type="file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    await detalhe.addAnexo.mutateAsync(f);
                    toast.success("Anexo enviado.");
                    e.target.value = "";
                  } catch (err: any) {
                    toast.error(err?.message ?? "Falha ao enviar anexo.");
                  }
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
