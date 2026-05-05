import { useEffect, useState } from "react";
import { MessageSquareWarning, RefreshCw, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useReclamacoesConfig } from "@/hooks/useReclamacoesConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

/**
 * Card de Configurações para o Mural de Comentários de Reclamações.
 * - Toggle ON/OFF (default OFF) — controla se o sync coleta comentários e se o Mural aparece no painel.
 * - Quando ligado: campo de URL da aba específica + botão de sync + classificador IA opcional.
 */
export function ReclamacoesCommentsToggle() {
  const { config, isLoading, update, source } = useReclamacoesConfig();
  const [url, setUrl] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (source?.url) setUrl(source.url);
  }, [source?.url]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const enabled = !!config?.enabled;

  const handleSaveUrl = async () => {
    if (!url.trim()) return;
    const normalized = url.trim();
    // Cria/atualiza fonte específica com meta_key='reclamacoes-comentarios'
    const { data: existing } = await supabase
      .from("sheets_sources")
      .select("id")
      .eq("meta_key", "reclamacoes-comentarios")
      .maybeSingle();

    if (existing?.id) {
      await supabase.from("sheets_sources").update({ url: normalized, ativo: true }).eq("id", existing.id);
      await update.mutateAsync({ source_id: existing.id });
    } else {
      const { data: ins, error } = await supabase
        .from("sheets_sources")
        .insert({
          nome: "Comentários de Reclamações",
          url: normalized,
          gid: "0",
          ativo: true,
          meta_key: "reclamacoes-comentarios",
        })
        .select("id")
        .single();
      if (error) {
        toast.error("Erro ao salvar URL.");
        return;
      }
      await update.mutateAsync({ source_id: ins.id });
    }
    toast.success("URL salva.");
  };

  const handleSync = async () => {
    if (!config?.source_id) {
      toast.error("Salve a URL antes de sincronizar.");
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-reclamacoes-comentarios", {
        body: { sourceId: config.source_id, classify: config.classificador_ai },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast.success(data?.message || "Comentários sincronizados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar comentários.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base uppercase">Comentários de Reclamações</CardTitle>
              <Badge variant={enabled ? "default" : "outline"} className="text-[10px]">
                {enabled ? "ATIVO" : "DESLIGADO"}
              </Badge>
            </div>
            <CardDescription className="text-xs max-w-2xl">
              Coleta comentários individuais (canal, nota, autor, texto) para o Mural de Comentários
              dentro da view de Reclamações. Esquema esperado da aba CSV:{" "}
              <code className="text-[11px]">data | loja | canal | nota | autor | comentario</code>.
              Quando desligado, o Mural fica oculto no painel.
            </CardDescription>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => update.mutate({ enabled: v })}
            disabled={update.isPending}
          />
        </div>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase">URL da aba (CSV)</Label>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..."
              />
              <Button size="sm" variant="outline" onClick={handleSaveUrl}>Salvar</Button>
            </div>
            {source?.ultima_sincronizacao && (
              <p className="text-[11px] text-muted-foreground">
                Última sync: {format(new Date(source.ultima_sincronizacao), "dd/MM/yyyy HH:mm")}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <Label htmlFor="ai-classifier" className="text-xs cursor-pointer">
                Classificar tags automaticamente com IA
              </Label>
            </div>
            <Switch
              id="ai-classifier"
              checked={!!config?.classificador_ai}
              onCheckedChange={(v) => update.mutate({ classificador_ai: v })}
              disabled={update.isPending}
            />
          </div>

          <Button size="sm" onClick={handleSync} disabled={syncing || !config?.source_id}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Sincronizar comentários agora
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
