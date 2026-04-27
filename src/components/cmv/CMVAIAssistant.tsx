import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  Loader2,
  TrendingDown,
  AlertTriangle,
  ListChecks,
  MessageSquare,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useCMVAIContext } from "@/hooks/useCMVAIContext";
import { CMVActionPlanCard, type ProposedActionPlan } from "./CMVActionPlanCard";
import { toast } from "sonner";

type Role = "user" | "assistant";
interface UIMessage {
  role: Role;
  content: string;
  plan?: ProposedActionPlan;
  flags?: SuspeitaFlag[];
}

interface SuspeitaFlag {
  item_nome: string;
  data: string;
  turno: string;
  valor_observado: number;
  valor_esperado: number;
  motivo: string;
}

const QUICK_ACTIONS = [
  {
    icon: TrendingDown,
    label: "Resumo do desvio da semana",
    prompt:
      "Faça um resumo do desvio dos últimos 7 dias: liste os top 5 itens com maior perda em kg e R$, identifique o turno mais crítico e compare com a tendência dos 30 dias. Seja direto.",
  },
  {
    icon: Lightbulb,
    label: "Onde está o desvio?",
    prompt:
      "Analise os 3 itens com maior desvio nos últimos 7 dias e, para cada um, identifique se a perda começa na CÂMARA (entrada vs saída), na PRAÇA (T1 vs T3) ou em ambas. Aponte dia/turno padrão se houver.",
  },
  {
    icon: AlertTriangle,
    label: "Contagens suspeitas (14 dias)",
    prompt:
      "Liste contagens suspeitas dos últimos 14 dias: variações maiores que 50% vs média do item, ou onde a saída da câmara não bate com a entrada da praça do mesmo dia. Use a tool flag_contagem_suspeita.",
  },
  {
    icon: ListChecks,
    label: "Gerar plano de ação",
    prompt:
      "Com base nos desvios atuais, gere um plano de ação corretivo focado no item de maior perda financeira. Use a tool propor_plano_acao com tarefas concretas, prazo e prioridade adequada.",
  },
];

export function CMVAIAssistant() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: context, isLoading: ctxLoading, refetch } = useCMVAIContext(effectiveUnidadeId);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // Reset chat when unit changes
  useEffect(() => {
    setMessages([]);
  }, [effectiveUnidadeId]);

  const send = async (text: string) => {
    if (!effectiveUnidadeId) {
      toast.error("Selecione uma unidade primeiro.");
      return;
    }
    if (!context) {
      toast.error("Aguarde o carregamento dos dados de CMV.");
      return;
    }
    if (!text.trim() || streaming) return;

    const userMsg: UIMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Placeholder do assistente para streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let assistantText = "";
    let proposedPlan: ProposedActionPlan | undefined;
    let suspeitas: SuspeitaFlag[] = [];

    // Acumuladores de tool call (vêm em deltas)
    const toolBuf = new Map<number, { name: string; args: string }>();

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cmv-ai-assistant`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Muitas requisições. Aguarde alguns segundos.");
        else if (resp.status === 402) toast.error("Créditos de IA esgotados.");
        else toast.error("Erro ao consultar a IA.");
        // Remove placeholder vazio
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              assistantText += delta.content;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: assistantText };
                return copy;
              });
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const cur = toolBuf.get(idx) ?? { name: "", args: "" };
                if (tc.function?.name) cur.name = tc.function.name;
                if (tc.function?.arguments) cur.args += tc.function.arguments;
                toolBuf.set(idx, cur);
              }
            }
          } catch {
            // Linha JSON parcial — devolve ao buffer
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Processa tool calls finais
      for (const { name, args } of toolBuf.values()) {
        if (!name || !args) continue;
        try {
          const parsed = JSON.parse(args);
          if (name === "propor_plano_acao") {
            proposedPlan = {
              titulo: String(parsed.titulo ?? ""),
              descricao: String(parsed.descricao ?? ""),
              prioridade: (["alta", "media", "baixa"].includes(parsed.prioridade)
                ? parsed.prioridade
                : "media") as ProposedActionPlan["prioridade"],
              prazo_dias: Number(parsed.prazo_dias ?? 7),
              tarefas: Array.isArray(parsed.tarefas) ? parsed.tarefas.map(String) : [],
              item_relacionado: String(parsed.item_relacionado ?? ""),
              turno_critico: parsed.turno_critico ? String(parsed.turno_critico) : undefined,
            };
          } else if (name === "flag_contagem_suspeita") {
            suspeitas.push({
              item_nome: String(parsed.item_nome ?? ""),
              data: String(parsed.data ?? ""),
              turno: String(parsed.turno ?? ""),
              valor_observado: Number(parsed.valor_observado ?? 0),
              valor_esperado: Number(parsed.valor_esperado ?? 0),
              motivo: String(parsed.motivo ?? ""),
            });
          }
        } catch (e) {
          console.warn("Tool args parse error:", name, e);
        }
      }

      // Atualiza última mensagem com plan/flags se houver
      if (proposedPlan || suspeitas.length > 0) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            plan: proposedPlan,
            flags: suspeitas.length > 0 ? suspeitas : undefined,
            content:
              copy[copy.length - 1].content ||
              (proposedPlan ? "Sugeri um plano de ação abaixo." : "Detectei contagens suspeitas abaixo."),
          };
          return copy;
        });
      }
    } catch (e) {
      console.error("stream error:", e);
      toast.error("Falha ao receber resposta da IA.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  if (!effectiveUnidadeId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-base font-medium">Selecione uma unidade acima</p>
          <p className="text-sm">Para conversar com o copiloto de CMV Carnes.</p>
        </CardContent>
      </Card>
    );
  }

  const ctxStats = context
    ? {
        itens: context.items.length,
        contagens: context.contagens14d.length,
        camara: context.camara.length,
        praca: context.praca.length,
      }
    : null;

  return (
    <div className="space-y-4">
      {/* Header explicativo */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base uppercase tracking-wide">Copiloto CMV Carnes</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Análise de desvio + contagens + plano de ação direto na Agenda do Líder
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={ctxLoading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${ctxLoading ? "animate-spin" : ""}`} />
              Atualizar dados
            </Button>
          </div>
        </CardHeader>
        {ctxStats && (
          <CardContent className="pt-0 flex flex-wrap gap-2">
            <Badge variant="outline">{ctxStats.itens} itens</Badge>
            <Badge variant="outline">{ctxStats.contagens} contagens (14d)</Badge>
            <Badge variant="outline">{ctxStats.camara} registros câmara</Badge>
            <Badge variant="outline">{ctxStats.praca} registros praça</Badge>
            {context?.semanaAtiva && (
              <Badge variant="outline" className="bg-background">
                Semana: {context.semanaAtiva.data_inicio} → {context.semanaAtiva.data_fim}
              </Badge>
            )}
          </CardContent>
        )}
      </Card>

      {/* Quick actions */}
      {messages.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((qa) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.label}
                onClick={() => send(qa.prompt)}
                disabled={streaming || ctxLoading || !context}
                className="text-left p-3 rounded-xl border bg-card hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium uppercase">{qa.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{qa.prompt}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Mensagens */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div ref={scrollRef} className="h-[480px] overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streaming && (
              <div className="text-center text-muted-foreground py-12">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Selecione uma ação rápida acima ou faça uma pergunta.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm"
                      : "max-w-full w-full space-y-3"
                  }
                >
                  {m.role === "assistant" ? (
                    <>
                      {m.content && (
                        <div className="prose prose-sm dark:prose-invert max-w-none rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-3">
                          {streaming && i === messages.length - 1 && !m.content && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      )}
                      {!m.content && streaming && i === messages.length - 1 && (
                        <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {m.flags && m.flags.length > 0 && (
                        <Card className="border-amber-500/30 bg-amber-500/5">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm uppercase flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                              Contagens suspeitas
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-2">
                            {m.flags.map((f, k) => (
                              <div key={k} className="text-sm border-l-2 border-amber-500/40 pl-3 py-1">
                                <div className="font-medium">
                                  {f.item_nome} — {f.data} ({f.turno})
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Observado: <span className="font-mono">{f.valor_observado.toFixed(2)} kg</span>
                                  {" · "}
                                  Esperado: <span className="font-mono">{f.valor_esperado.toFixed(2)} kg</span>
                                </div>
                                <div className="text-xs mt-1">{f.motivo}</div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                      {m.plan && effectiveUnidadeId && (
                        <CMVActionPlanCard
                          plan={m.plan}
                          unitId={effectiveUnidadeId}
                          onDismiss={() => {
                            setMessages((prev) =>
                              prev.map((mm, idx) => (idx === i ? { ...mm, plan: undefined } : mm)),
                            );
                          }}
                        />
                      )}
                    </>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t p-3 bg-background">
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Pergunte sobre desvio, contagens ou peça um plano de ação..."
                rows={1}
                className="resize-none min-h-[44px] max-h-32"
                disabled={streaming || ctxLoading}
              />
              <Button
                onClick={() => send(input)}
                disabled={streaming || ctxLoading || !input.trim()}
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              Escopo: análise de desvio e contagens da unidade selecionada. Toda métrica vem dos seus dados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
