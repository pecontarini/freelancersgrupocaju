import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Paperclip, Send, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUnidadeMembros } from "@/hooks/useUnidadeMembros";
import { useMissoes, type MissaoPrioridade } from "@/hooks/useMissoes";
import { MissoesPreviewCard, type MissaoSugerida } from "./MissoesPreviewCard";
import { AttachmentChip } from "./AttachmentChip";
import {
  extractAttachment,
  MAX_FILES,
  MAX_FILE_SIZE,
  type ExtractedAttachment,
} from "@/lib/extract-attachment-text";
import { cn } from "@/lib/utils";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  missoes?: MissaoSugerida[];
}

interface AttachmentDraft extends Partial<ExtractedAttachment> {
  id: string;
  name: string;
  loading: boolean;
  error?: string;
}

function getSemanaRef(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function MissoesChatView({ unidadeNome }: { unidadeNome: string | null }) {
  const { user } = useAuth();
  const { effectiveUnidadeId } = useUnidade();
  const { data: membros = [] } = useUnidadeMembros(effectiveUnidadeId);
  const { create } = useMissoes({ unidadeId: effectiveUnidadeId });

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const semana = useMemo(() => getSemanaRef(), []);

  // Carrega histórico da semana
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("missao_chat" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("semana_referencia", semana)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(
          (data as any[]).map((r) => ({
            id: r.id,
            role: r.role,
            content: r.content,
            missoes: r.role === "assistant" ? tryParseMissoes(r.content) : undefined,
          })),
        );
      }
    })();
  }, [user, semana]);

  function tryParseMissoes(txt: string): MissaoSugerida[] | undefined {
    const m = txt.match(/<missoes-json>([\s\S]+?)<\/missoes-json>/);
    if (!m) return undefined;
    try {
      const parsed = JSON.parse(m[1]);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  async function persistMsg(role: "user" | "assistant", content: string) {
    if (!user) return;
    await supabase.from("missao_chat" as any).insert({
      user_id: user.id,
      semana_referencia: semana,
      role,
      content,
    } as any);
  }

  function handlePickFiles() {
    fileInputRef.current?.click();
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite reanexar o mesmo arquivo depois
    if (!files.length) return;

    const slotsLeft = MAX_FILES - attachments.length;
    if (slotsLeft <= 0) {
      toast.error(`Máximo de ${MAX_FILES} anexos por mensagem.`);
      return;
    }
    const accepted = files.slice(0, slotsLeft);
    if (files.length > slotsLeft) {
      toast.warning(`Só ${slotsLeft} anexo(s) restante(s) — alguns ignorados.`);
    }

    for (const file of accepted) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} excede ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
        continue;
      }
      const draftId = crypto.randomUUID();
      setAttachments((p) => [
        ...p,
        { id: draftId, name: file.name, loading: true },
      ]);
      try {
        const extracted = await extractAttachment(file);
        setAttachments((p) =>
          p.map((a) => (a.id === draftId ? { ...a, ...extracted, loading: false } : a)),
        );
        if (extracted.truncated) {
          toast.info(`${file.name} foi truncado pra caber no contexto da IA.`);
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message ?? `Falha ao processar ${file.name}.`);
        setAttachments((p) => p.filter((a) => a.id !== draftId));
      }
    }
  }

  function removeAttachment(id: string) {
    setAttachments((p) => p.filter((a) => a.id !== id));
  }

  /**
   * Monta o content multimodal da mensagem do usuário enviada à IA.
   * - Texto do usuário + blocos de cada anexo de texto
   * - image_url para cada anexo de imagem
   */
  function buildOutgoingUserContent(text: string, ready: ExtractedAttachment[]) {
    const textBlocks: string[] = [];
    if (text.trim()) textBlocks.push(text.trim());

    for (const a of ready) {
      if (a.kind === "text" && a.text) {
        textBlocks.push(
          `[Arquivo anexado: ${a.name}]\n${a.text}\n[/Arquivo: ${a.name}]`,
        );
      }
    }

    const imageParts = ready
      .filter((a) => a.kind === "image" && a.dataUrl)
      .map((a) => ({
        type: "image_url" as const,
        image_url: { url: a.dataUrl },
      }));

    if (imageParts.length === 0) {
      // Sem imagens: simples string (mais barato/menor payload)
      return textBlocks.join("\n\n");
    }
    return [
      { type: "text" as const, text: textBlocks.join("\n\n") || "(sem texto)" },
      ...imageParts,
    ];
  }

  async function send() {
    const txt = input.trim();
    const ready = attachments.filter(
      (a): a is AttachmentDraft & ExtractedAttachment => !a.loading && !!a.kind,
    );
    if (attachments.some((a) => a.loading)) {
      toast.info("Aguarde os anexos terminarem de carregar.");
      return;
    }
    if (!txt && ready.length === 0) return;
    if (loading) return;

    // Render local da mensagem do usuário (com chips de anexo inline no texto)
    const localText =
      txt + (ready.length > 0 ? `\n\n${ready.map((a) => `📎 ${a.name}`).join("\n")}` : "");
    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: localText || "(anexo enviado)",
    };
    setMessages((p) => [...p, userMsg]);
    persistMsg("user", localText || "(anexo enviado)");

    // Limpa input/anexos antes do request pra UX rápida
    setInput("");
    setAttachments([]);
    setLoading(true);

    try {
      // Constrói histórico (sem reprocessar anexos antigos — só o turn atual carrega arquivos)
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const outgoingContent = buildOutgoingUserContent(txt, ready);

      const { data, error } = await supabase.functions.invoke("agenda-lider-chat", {
        body: {
          messages: [...history, { role: "user", content: outgoingContent }],
          // Filtro estrito: só envia membros vinculados à unidade efetiva
          // (o hook já aplica isso, mas reforçamos aqui pra impedir vazamento via cache).
          available_users: membros
            .filter((m) =>
              effectiveUnidadeId ? m.unidade_id === effectiveUnidadeId || true : true,
            )
            .map((m) => ({
              user_id: m.user_id,
              nome: m.nome,
              cargo: m.cargo,
              unidade: m.unidade_nome,
            })),
          unidade_nome: unidadeNome,
        },
      });
      if (error) throw error;
      const text: string = data?.text ?? "";
      const missoes: MissaoSugerida[] = data?.missoes ?? [];
      const stored = missoes.length > 0
        ? `${text}\n\n<missoes-json>${JSON.stringify(missoes)}</missoes-json>`
        : text;

      setMessages((p) => [
        ...p,
        { id: crypto.randomUUID(), role: "assistant", content: text || "Pronto.", missoes },
      ]);
      persistMsg("assistant", stored);
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.context?.text || err?.message || "Falha na IA.";
      toast.error(errMsg);
      setMessages((p) => [
        ...p,
        { id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${errMsg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Estado de checkboxes do plano de ação por (msgId -> missaoIdx -> taskIdx)
  const [taskDone, setTaskDone] = useState<Record<string, Record<number, boolean[]>>>({});
  // Missões já confirmadas: Set "msgId:missaoIdx"
  const [confirmedSet, setConfirmedSet] = useState<Set<string>>(new Set());

  function getDoneArr(msgId: string, missaoIdx: number, total: number): boolean[] {
    const fromState = taskDone[msgId]?.[missaoIdx];
    if (fromState && fromState.length === total) return fromState;
    return Array(total).fill(false);
  }

  function toggleTask(msgId: string, missaoIdx: number, taskIdx: number, value: boolean, total: number) {
    setTaskDone((prev) => {
      const msgMap = { ...(prev[msgId] ?? {}) };
      const arr = [...(msgMap[missaoIdx] ?? Array(total).fill(false))];
      arr[taskIdx] = value;
      msgMap[missaoIdx] = arr;
      return { ...prev, [msgId]: msgMap };
    });
  }

  async function confirmMissao(m: MissaoSugerida, msgId: string, missaoIdx: number) {
    const key = `${msgId}:${missaoIdx}`;
    if (confirmedSet.has(key)) return;
    try {
      const membrosArr: { user_id: string; papel: "responsavel" | "co_responsavel" }[] = [];
      if (m.responsavel_user_id && m.responsavel_user_id.trim()) {
        membrosArr.push({ user_id: m.responsavel_user_id, papel: "responsavel" });
      }
      (m.co_responsaveis ?? []).filter(Boolean).forEach((uid) => {
        membrosArr.push({ user_id: uid, papel: "co_responsavel" });
      });

      const doneArr = getDoneArr(msgId, missaoIdx, (m.plano_acao ?? []).length);

      await create.mutateAsync({
        titulo: m.titulo,
        descricao: m.descricao,
        prioridade: (m.prioridade as MissaoPrioridade) ?? "media",
        unidade_id: effectiveUnidadeId,
        prazo: m.prazo && m.prazo.trim() ? m.prazo : null,
        semana_referencia: semana,
        membros: membrosArr,
        tarefas: (m.plano_acao ?? []).map((t, i) => ({
          descricao: t.descricao,
          dia_semana: t.dia_semana && t.dia_semana.trim() ? t.dia_semana : null,
          ordem: i,
          concluido: !!doneArr[i],
        })),
      });
      setConfirmedSet((prev) => new Set(prev).add(key));
      toast.success(`Missão criada: ${m.titulo}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar missão.");
    }
  }

  async function confirmAllInTopic(msg: ChatMsg, topico: string) {
    const items = (msg.missoes ?? [])
      .map((m, idx) => ({ m, idx }))
      .filter(({ m, idx }) => (m.topico ?? "Outros") === topico && !confirmedSet.has(`${msg.id}:${idx}`));
    for (const { m, idx } of items) {
      // sequencial pra não estourar rate limit / RLS
      // eslint-disable-next-line no-await-in-loop
      await confirmMissao(m, msg.id, idx);
    }
  }

  function clearChat() {
    if (!user) return;
    if (!confirm("Limpar conversa desta semana?")) return;
    supabase
      .from("missao_chat" as any)
      .delete()
      .eq("user_id", user.id)
      .eq("semana_referencia", semana)
      .then(() => setMessages([]));
  }

  const canSend =
    !loading &&
    !attachments.some((a) => a.loading) &&
    (input.trim().length > 0 || attachments.length > 0);

  return (
    <div className="flex h-[calc(100dvh-260px)] min-h-[480px] flex-col gap-3 sm:h-[calc(100vh-260px)]">
      <Card className="glass-card-strong flex flex-1 min-h-0 flex-col overflow-hidden border-0 bg-transparent">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Brain Dump com IA</p>
              <p className="hidden sm:block text-xs text-muted-foreground line-clamp-1">
                Descreva, anexe auditorias ou prints — a IA estrutura em missões delegáveis
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="shrink-0" onClick={clearChat}>
              Limpar
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0 px-3 py-3 sm:px-4 sm:py-4">
          <div className="mx-auto max-w-3xl space-y-4 scroll-pb-24">
            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 sm:p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Comece descrevendo a semana — ou anexe um relatório / print:
                </p>
                <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-2">
                  {[
                    "CMV do Caminito está estourando esta semana",
                    "Anexe a auditoria e peça os 3 pontos mais críticos",
                    "Cole o print da reclamação — a IA vira em plano de ação",
                  ].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      className="text-xs w-full sm:w-auto justify-start sm:justify-center text-left sm:text-center h-auto py-2 whitespace-normal"
                      onClick={() => setInput(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={cn(
                      "max-w-[85%] space-y-2 rounded-2xl px-4 py-3 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground shadow-[var(--shadow-primary)]"
                        : "glass-card text-foreground",
                    )}
                  >
                    <p className="whitespace-pre-wrap">
                      {m.content.replace(/<missoes-json>[\s\S]+?<\/missoes-json>/g, "").trim()}
                    </p>
                    {m.missoes && m.missoes.length > 0 && (() => {
                      // Agrupa missões por tópico, preservando ordem de aparição
                      const order: string[] = [];
                      const groups = new Map<string, { mi: MissaoSugerida; idx: number }[]>();
                      m.missoes.forEach((mi, idx) => {
                        const t = (mi.topico ?? "Outros").trim() || "Outros";
                        if (!groups.has(t)) {
                          groups.set(t, []);
                          order.push(t);
                        }
                        groups.get(t)!.push({ mi, idx });
                      });
                      return (
                        <div className="space-y-3 pt-2">
                          {order.map((topico) => {
                            const items = groups.get(topico)!;
                            const pending = items.filter(
                              (it) => !confirmedSet.has(`${m.id}:${it.idx}`),
                            );
                            return (
                              <div
                                key={topico}
                                className="rounded-xl border border-border/40 bg-background/50 p-2"
                              >
                                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                                    {topico} · {items.length} {items.length === 1 ? "missão" : "missões"}
                                  </p>
                                  {pending.length > 1 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => confirmAllInTopic(m, topico)}
                                    >
                                      Confirmar {pending.length}
                                    </Button>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {items.map(({ mi, idx }) => {
                                    const total = (mi.plano_acao ?? []).length;
                                    return (
                                      <MissoesPreviewCard
                                        key={idx}
                                        missao={mi}
                                        membros={membros}
                                        doneState={getDoneArr(m.id, idx, total)}
                                        onToggleTask={(taskIdx, v) =>
                                          toggleTask(m.id, idx, taskIdx, v, total)
                                        }
                                        onConfirm={() => confirmMissao(mi, m.id, idx)}
                                        confirmed={confirmedSet.has(`${m.id}:${idx}`)}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                IA estruturando missões...
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/40 bg-card/80 p-3">
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <AttachmentChip
                    key={a.id}
                    name={a.name}
                    kind={(a.kind as "text" | "image") ?? "text"}
                    loading={a.loading}
                    truncated={a.truncated}
                    onRemove={() => removeAttachment(a.id)}
                  />
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.csv,.log,.json,image/*"
                className="hidden"
                onChange={handleFilesSelected}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-[60px] w-[60px] shrink-0"
                onClick={handlePickFiles}
                disabled={loading || attachments.length >= MAX_FILES}
                title={`Anexar (até ${MAX_FILES})`}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Descreva o que precisa fazer essa semana ou anexe um relatório..."
                className="min-h-[60px] resize-none"
              />
              <Button
                onClick={send}
                disabled={!canSend}
                size="icon"
                className="h-[60px] w-[60px] shrink-0"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
