import { useEffect, useRef, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Sparkles,
  X,
  Wand2,
  ShieldCheck,
  MessageSquarePlus,
  Loader2,
  Check,
  Trash2,
  Paperclip,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePOPWizard, type WizardMode, type ChatMessage } from "@/hooks/usePOPWizard";
import { POPWizardPreview } from "./POPWizardPreview";
import { POPWizardMultiPanel } from "./POPWizardMultiPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Brand } from "@/lib/holding/sectors";
import {
  extractAttachment,
  MAX_FILE_SIZE,
} from "@/lib/extract-attachment-text";
import ReactMarkdown from "react-markdown";

const ACCEPTED_FILES =
  ".pdf,.xlsx,.xls,.xlsm,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,image/*,text/*";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function messageToText(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => (part.type === "text" ? part.text : "[imagem anexada]"))
    .join("\n");
}

interface POPWizardDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brand: Brand;
  unitId: string;
  unitName?: string;
  monthYear: string;
}

const QUICK_PROMPTS: Array<{ mode: WizardMode; label: string; icon: any; text: string }> = [
  {
    mode: "wizard",
    label: "Sugerir do zero (entrevista)",
    icon: Wand2,
    text: "Quero montar uma proposta completa de Tabela Mínima para esta unidade. Me guie com perguntas curtas antes de propor.",
  },
  {
    mode: "validate",
    label: "Validar atual",
    icon: ShieldCheck,
    text: "Revise minha configuração atual de mínimos. Aponte furos, turnos sub-dimensionados, setores zerados e proponha correções pontuais.",
  },
];

export function POPWizardDrawer({
  open,
  onOpenChange,
  brand,
  unitId,
  unitName,
  monthYear,
}: POPWizardDrawerProps) {
  const wizard = usePOPWizard({ brand, unitId, unitName, monthYear });
  const [input, setInput] = useState("");
  const [extracting, setExtracting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [wizard.messages, wizard.isStreaming]);

  // Reset on close
  useEffect(() => {
    if (!open) wizard.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFilePick = () => {
    if (wizard.isStreaming || extracting) return;
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reanexar mesmo arquivo
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `${file.name} tem ${(file.size / 1024 / 1024).toFixed(1)} MB — limite ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      );
      return;
    }
    setExtracting(true);
    try {
      const att = await extractAttachment(file);
      wizard.addAttachment(att);
      if (!input.trim()) {
        setInput(
          "Use este POP anexado para preencher a Tabela Mínima desta unidade. Mapeie cada linha para os setores válidos e gere a proposta.",
        );
      }
      toast.success(`${att.name} pronto para enviar.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao ler o arquivo.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSend = (mode: WizardMode = "wizard") => {
    const text = input.trim();
    if ((!text && wizard.attachments.length === 0) || wizard.isStreaming) return;
    setInput("");
    wizard.sendMessage(text || "Use o anexo para gerar a proposta.", mode);
  };

  const handleQuick = (q: typeof QUICK_PROMPTS[number]) => {
    if (wizard.isStreaming) return;
    wizard.sendMessage(q.text, q.mode);
  };

  const handleProposeNow = () => {
    if (wizard.isStreaming) return;
    wizard.sendMessage(
      "Pode propor agora com o contexto atual, sem mais perguntas.",
      "wizard",
    );
  };

  const isInterviewing =
    wizard.messages.length > 0 && !wizard.proposed && !wizard.isStreaming;

  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      direction="right"
      shouldScaleBackground={false}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-40 flex h-full w-full sm:w-[720px] flex-col",
            "bg-background/95 backdrop-blur-xl border-l border-border shadow-2xl",
            "outline-none",
          )}
        >
          <DrawerPrimitive.Title className="sr-only">POP Wizard</DrawerPrimitive.Title>
          <DrawerPrimitive.Description className="sr-only">
            Assistente de IA para configurar a Tabela Mínima de pessoas.
          </DrawerPrimitive.Description>

          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4 bg-primary/5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/15 p-2">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold uppercase tracking-wide text-foreground">
                  POP Wizard
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assistente para Tabela Mínima
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge variant="secondary" className="text-[10px]">{brand}</Badge>
                  {unitName && (
                    <Badge variant="secondary" className="text-[10px]">{unitName}</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{monthYear}</Badge>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs: Esta unidade vs. Multi-unidade */}
          <Tabs defaultValue="single" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="mx-3 mt-2 grid grid-cols-2 h-9 shrink-0">
              <TabsTrigger value="single" className="text-xs">Esta unidade</TabsTrigger>
              <TabsTrigger value="multi" className="text-xs">Multi-unidade (todas)</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="flex flex-1 flex-col overflow-hidden mt-2 data-[state=inactive]:hidden">
          {/* Body: chat (top) + preview (bottom) */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Chat area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
            >
              {wizard.messages.length === 0 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
                    <p className="font-semibold text-foreground mb-1">Como funciona</p>
                    <p>
                      Vou te fazer algumas perguntas curtas antes de propor.
                      Se quiser, <strong>anexe o arquivo do POP</strong> (PDF,
                      Excel, foto ou texto) usando o clipe abaixo — eu leio e
                      gero a Tabela Mínima já preenchida para você só ajustar.
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Como quer começar?
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={handleFilePick}
                      disabled={wizard.isStreaming || extracting}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 backdrop-blur-sm",
                        "p-3 text-left text-sm hover:bg-primary/10 hover:border-primary/60 transition-colors",
                        "disabled:opacity-50",
                      )}
                    >
                      <Paperclip className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-foreground">
                          Anexar POP e preencher
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Envie o documento do POP (PDF, Excel, foto). Eu leio
                          e proponho a Tabela Mínima automaticamente.
                        </div>
                      </div>
                    </button>
                    {QUICK_PROMPTS.map((q) => {
                      const Icon = q.icon;
                      return (
                        <button
                          key={q.label}
                          onClick={() => handleQuick(q)}
                          disabled={wizard.isStreaming}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 backdrop-blur-sm",
                            "p-3 text-left text-sm hover:bg-primary/5 hover:border-primary/40 transition-colors",
                            "disabled:opacity-50",
                          )}
                        >
                          <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <div className="font-semibold text-foreground">{q.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {q.text}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/30 p-3 text-xs text-muted-foreground">
                      <MessageSquarePlus className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        Ou descreva no campo abaixo um ajuste pontual (ex: "aumentar
                        garçom no jantar de sexta para 6").
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {wizard.messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm max-w-[92%]",
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-muted/60 backdrop-blur-sm border border-border/40",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1">
                      <ReactMarkdown>{messageToText(m.content) || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{messageToText(m.content)}</span>
                  )}
                </div>
              ))}

              {wizard.isStreaming && (
                <div className="mr-auto bg-muted/60 border border-border/40 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                </div>
              )}
            </div>

            {/* Preview area */}
            {wizard.proposed && (
              <div className="border-t border-border/60 bg-muted/20 backdrop-blur-sm max-h-[40%] overflow-y-auto">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/90 backdrop-blur-md p-3 border-b border-border/40">
                  <div className="text-xs font-semibold uppercase tracking-wide">
                    Mudanças propostas
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={wizard.discardProposed}
                      disabled={wizard.isApplying}
                      className="h-8"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Descartar
                    </Button>
                    <Button
                      size="sm"
                      onClick={wizard.applyProposed}
                      disabled={wizard.isApplying}
                      className="h-8"
                    >
                      {wizard.isApplying ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      Aplicar
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <POPWizardPreview
                    proposed={wizard.proposed}
                    currentConfig={wizard.currentConfig}
                  />
                </div>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-border/60 p-3 bg-background/80 backdrop-blur-md">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_FILES}
                onChange={handleFileChange}
                className="hidden"
              />

              {wizard.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {wizard.attachments.map((a) => {
                    const Icon = a.kind === "image" ? ImageIcon : FileText;
                    return (
                      <div
                        key={a.name}
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-foreground"
                      >
                        <Icon className="h-3 w-3 text-primary" />
                        <span className="font-medium truncate max-w-[180px]">{a.name}</span>
                        <span className="text-muted-foreground">{formatSize(a.size)}</span>
                        {a.truncated && (
                          <span className="text-amber-600 dark:text-amber-400">truncado</span>
                        )}
                        <button
                          type="button"
                          onClick={() => wizard.removeAttachment(a.name)}
                          className="ml-0.5 rounded hover:bg-background/60 p-0.5"
                          aria-label={`Remover ${a.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleFilePick}
                  disabled={wizard.isStreaming || extracting}
                  className="h-11 w-11 shrink-0"
                  aria-label="Anexar POP"
                  title="Anexar POP (PDF, Excel, foto, texto)"
                >
                  {extracting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend("wizard");
                    }
                  }}
                  placeholder={
                    wizard.attachments.length > 0
                      ? "Descreva o que quer (ou envie direto)…"
                      : "Pergunte, peça um ajuste ou anexe o POP…"
                  }
                  className="min-h-[44px] max-h-32 resize-none text-sm"
                  disabled={wizard.isStreaming}
                />
                <Button
                  onClick={() => handleSend("wizard")}
                  disabled={
                    wizard.isStreaming ||
                    (!input.trim() && wizard.attachments.length === 0)
                  }
                  size="icon"
                  className="h-11 w-11 shrink-0"
                >
                  {wizard.isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {isInterviewing && (
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleProposeNow}
                    className="h-7 text-[11px] text-muted-foreground hover:text-primary"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Propor agora com o que temos
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Enter envia · Shift+Enter quebra linha · Anexos: PDF, Excel,
                foto ou texto (até 10 MB) · As mudanças passam por revisão.
              </p>
            </div>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
