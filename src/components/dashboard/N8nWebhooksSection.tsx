import { useMemo, useState } from "react";
import {
  Webhook,
  Plus,
  Copy,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useN8nWebhooks,
  useN8nExecutions,
  buildWebhookUrl,
  type N8nEndpoint,
} from "@/hooks/useN8nWebhooks";

// ---------- helpers ----------
function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiado`),
    () => toast.error("Falha ao copiar"),
  );
}

function StatusBadge({ status }: { status: "success" | "partial" | "error" }) {
  const map = {
    success: { icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", label: "Sucesso" },
    partial: { icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-700 border-amber-500/30", label: "Parcial" },
    error: { icon: XCircle, cls: "bg-red-500/15 text-red-700 border-red-500/30", label: "Erro" },
  } as const;
  const Item = map[status];
  const Icon = Item.icon;
  return (
    <Badge variant="outline" className={Item.cls}>
      <Icon className="mr-1 h-3 w-3" />
      {Item.label}
    </Badge>
  );
}

// ============================================================
// Modal: Criar endpoint
// ============================================================
function CriarEndpointDialog() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [lojaId, setLojaId] = useState<string>("__none__");
  const [created, setCreated] = useState<N8nEndpoint | null>(null);
  const { create } = useN8nWebhooks();

  const { data: lojas = [] } = useQuery({
    queryKey: ["config_lojas_select"],
    queryFn: async () => {
      const { data } = await supabase.from("config_lojas").select("id, nome").order("nome");
      return data || [];
    },
  });

  const handleCreate = async () => {
    if (!nome.trim()) {
      toast.error("Informe um nome");
      return;
    }
    try {
      const result = await create.mutateAsync({
        nome: nome.trim(),
        slug: slug.trim() || undefined,
        loja_id_default: lojaId === "__none__" ? null : lojaId,
      });
      setCreated(result);
    } catch {
      // toast já tratado no hook
    }
  };

  const handleClose = () => {
    setOpen(false);
    setNome("");
    setSlug("");
    setLojaId("__none__");
    setCreated(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(v) : handleClose())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Endpoint Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>Criar Endpoint para n8n</DialogTitle>
              <DialogDescription>
                Cada endpoint representa uma automação do n8n (ex.: "Google Reviews — Diário").
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome da automação</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Google Reviews — Diário"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (opcional, gerado automaticamente)</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="google-reviews-diario"
                />
                <p className="text-xs text-muted-foreground">
                  Aparecerá na URL do webhook. Use apenas letras, números e hífens.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Loja padrão (opcional)</Label>
                <Select value={lojaId} onValueChange={setLojaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Detectar pelo nome enviado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Detectar pelo nome enviado</SelectItem>
                    {lojas.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se preenchido, todas as reclamações deste endpoint serão associadas a esta loja.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar e gerar token
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Endpoint criado!
              </DialogTitle>
              <DialogDescription>
                <strong>Copie o token agora — ele não será mostrado de novo.</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">URL</Label>
                <div className="mt-1 flex gap-2">
                  <Input readOnly value={buildWebhookUrl(created.slug)} className="font-mono text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(buildWebhookUrl(created.slug), "URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Bearer Token</Label>
                <div className="mt-1 flex gap-2">
                  <Input readOnly value={created.secret_token} className="font-mono text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(created.secret_token, "Token")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Concluir</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Drawer: Histórico de execuções
// ============================================================
function HistoricoDrawer({
  endpoint,
  onClose,
}: {
  endpoint: N8nEndpoint | null;
  onClose: () => void;
}) {
  const { data: execs = [], isLoading } = useN8nExecutions(endpoint?.id ?? null);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Sheet open={!!endpoint} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Histórico — {endpoint?.nome}
          </SheetTitle>
          <SheetDescription>Últimas 50 execuções vindas do n8n</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-2">
          {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
          {!isLoading && execs.length === 0 && (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              Nenhuma execução ainda. Configure o webhook no n8n e dispare um teste.
            </div>
          )}
          {execs.map((e) => (
            <Card key={e.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={e.status} />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">{e.linhas_inseridas}</span> inseridas ·{" "}
                      <span className="text-muted-foreground">{e.linhas_duplicadas} duplicadas</span> ·{" "}
                      <span className="text-amber-700">{e.linhas_invalidas} inválidas</span> · de{" "}
                      {e.linhas_processadas} processadas
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    {expanded === e.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {expanded === e.id && (
                  <div className="mt-3 space-y-2">
                    {Array.isArray(e.erros) && e.erros.length > 0 && (
                      <div>
                        <Label className="text-xs uppercase text-amber-700">Erros</Label>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-amber-50 p-2 text-xs">
                          {JSON.stringify(e.erros, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">Payload recebido</Label>
                      <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted/40 p-2 text-xs">
                        {JSON.stringify(e.payload_recebido, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// Card de instruções para o n8n
// ============================================================
function InstrucoesCard() {
  const exemploPayload = `{
  "reclamacoes": [
    {
      "loja": "Caju Limão Centro",
      "fonte": "google",
      "tipo_operacao": "salao",
      "data_reclamacao": "2026-04-26",
      "nota_reclamacao": 2,
      "texto_original": "Demorou 40 minutos para o pedido chegar...",
      "resumo_ia": "Demora no atendimento",
      "temas": ["atendimento", "tempo"]
    }
  ]
}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ExternalLink className="h-4 w-4" /> Como configurar no n8n
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ol className="list-decimal space-y-2 pl-5">
          <li>No n8n, adicione o nó <strong>HTTP Request</strong> ao final do workflow.</li>
          <li>Method: <code className="rounded bg-muted px-1">POST</code></li>
          <li>URL: cole a URL do endpoint criado abaixo.</li>
          <li>
            Authentication: <strong>Header Auth</strong> · Header Name:{" "}
            <code className="rounded bg-muted px-1">Authorization</code> · Value:{" "}
            <code className="rounded bg-muted px-1">Bearer SEU_TOKEN</code>
          </li>
          <li>Body Content Type: <code className="rounded bg-muted px-1">JSON</code></li>
          <li>
            Body: array <code className="rounded bg-muted px-1">reclamacoes</code> com os campos abaixo.
          </li>
          <li>
            Schedule no n8n: configure o trigger para 1x ou 2x ao dia conforme necessário.
          </li>
        </ol>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs uppercase text-muted-foreground">Exemplo de payload</Label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(exemploPayload, "Payload de exemplo")}
            >
              <Copy className="mr-1 h-3 w-3" /> Copiar
            </Button>
          </div>
          <pre className="overflow-auto rounded bg-muted/40 p-3 text-xs">{exemploPayload}</pre>
        </div>
        <p className="text-xs text-muted-foreground">
          Campos obrigatórios por linha: <code>fonte</code> (google|ifood|tripadvisor|getin|sheets),{" "}
          <code>tipo_operacao</code> (salao|delivery), <code>nota_reclamacao</code> (1–5).{" "}
          A loja é resolvida por <code>loja_id</code>, <code>loja</code> (nome com fuzzy match) ou loja padrão do endpoint.
          Reclamações duplicadas (mesma loja + fonte + data + texto) são automaticamente ignoradas.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Componente principal
// ============================================================
export function N8nWebhooksSection() {
  const { list, update, regenerateToken, remove } = useN8nWebhooks();
  const [historicoFor, setHistoricoFor] = useState<N8nEndpoint | null>(null);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  const endpoints = list.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Webhook className="h-5 w-5 text-primary" />
            Webhooks n8n — Reclamações
          </h3>
          <p className="text-sm text-muted-foreground">
            Conecte automações do n8n para enviar reclamações automaticamente para o painel.
          </p>
        </div>
        <CriarEndpointDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando endpoints…</div>
          ) : endpoints.length === 0 ? (
            <div className="p-8 text-center">
              <Webhook className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nenhum endpoint criado ainda. Crie o primeiro para começar a receber reclamações do n8n.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug / URL</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recebidas</TableHead>
                  <TableHead>Última execução</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((ep) => {
                  const url = buildWebhookUrl(ep.slug);
                  const showToken = showTokens[ep.id];
                  return (
                    <TableRow key={ep.id}>
                      <TableCell className="font-medium">{ep.nome}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{ep.slug}</code>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToClipboard(url, "URL")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {showToken ? ep.secret_token.slice(0, 16) + "…" : "••••••••••••"}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setShowTokens((s) => ({ ...s, [ep.id]: !s[ep.id] }))}
                          >
                            {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(ep.secret_token, "Token")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={ep.ativo}
                          onCheckedChange={(v) => update.mutate({ id: ep.id, ativo: v })}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{ep.total_recebido}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ep.ultima_execucao_at
                          ? format(new Date(ep.ultima_execucao_at), "dd/MM HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setHistoricoFor(ep)} title="Ver histórico">
                            <Activity className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" title="Regenerar token">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Regenerar token?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O token atual deixará de funcionar imediatamente. Atualize o n8n com o novo token.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => regenerateToken.mutate(ep.id)}>
                                  Regenerar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" title="Remover">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover endpoint?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. As reclamações já recebidas permanecem no banco.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove.mutate(ep.id)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InstrucoesCard />

      <HistoricoDrawer endpoint={historicoFor} onClose={() => setHistoricoFor(null)} />
    </div>
  );
}
