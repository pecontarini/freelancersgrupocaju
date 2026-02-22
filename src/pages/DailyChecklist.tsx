import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, MessageSquare, MessageCircle, Loader2, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { SECTOR_POSITION_MAP, type AuditSector } from "@/lib/sectorPositionMapping";
import logoImg from "@/assets/grupo-caju-logo.png";

interface ChecklistItem {
  id: string;
  item_text: string;
  item_order: number;
  weight: number;
  original_category: string | null;
}

interface ItemResponse {
  template_item_id: string;
  is_conforming: boolean | null;
  observation: string;
  photo_url: string | null;
}

type SubmitResult = {
  total_score: number;
  total_items: number;
  conforming_items: number;
  sector_code: string;
  loja_name: string;
};

export default function DailyChecklist() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondedByName, setRespondedByName] = useState("");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [responses, setResponses] = useState<Record<string, ItemResponse>>({});
  const [expandedObs, setExpandedObs] = useState<Record<string, boolean>>({});
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [existingScore, setExistingScore] = useState<number | null>(null);

  const [linkId, setLinkId] = useState("");
  const [lojaName, setLojaName] = useState("");
  const [sectorCode, setSectorCode] = useState("");

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    fetchChecklist();
  }, [accessToken]);

  async function fetchChecklist() {
    try {
      setLoading(true);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-daily-checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch", access_token: accessToken }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Link inválido");
        return;
      }
      const { data } = json;
      setLinkId(data.link_id);
      setLojaName(data.loja_name);
      setSectorCode(data.sector_code);
      setItems(data.items);
      setAlreadySubmitted(data.already_submitted);
      setExistingScore(data.existing_score);

      const initial: Record<string, ItemResponse> = {};
      data.items.forEach((item: ChecklistItem) => {
        initial[item.id] = {
          template_item_id: item.id,
          is_conforming: null,
          observation: "",
          photo_url: null,
        };
      });
      setResponses(initial);
    } catch (err) {
      setError("Erro ao carregar checklist");
    } finally {
      setLoading(false);
    }
  }

  const answeredCount = useMemo(() => {
    return Object.values(responses).filter((r) => r.is_conforming !== null).length;
  }, [responses]);

  const progressPercent = items.length > 0 ? (answeredCount / items.length) * 100 : 0;
  const allAnswered = answeredCount === items.length && items.length > 0;

  const sectorDisplayName = SECTOR_POSITION_MAP[sectorCode as AuditSector]?.displayName || sectorCode;
  const today = format(new Date(), "dd 'de' MMMM, yyyy (EEEE)", { locale: ptBR });

  function setAnswer(itemId: string, conforming: boolean) {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], is_conforming: conforming },
    }));
  }

  function setObservation(itemId: string, obs: string) {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], observation: obs },
    }));
  }

  function toggleObs(itemId: string) {
    setExpandedObs((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  async function handleSubmit() {
    if (!respondedByName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }
    if (!allAnswered) {
      toast.error("Responda todos os itens antes de enviar");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-daily-checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          access_token: accessToken,
          responded_by_name: respondedByName.trim(),
          responses: Object.values(responses).map((r) => ({
            template_item_id: r.template_item_id,
            is_conforming: r.is_conforming,
            observation: r.observation || null,
            photo_url: r.photo_url || null,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Erro ao enviar checklist");
        return;
      }
      setSubmitResult(json.data);
    } catch {
      toast.error("Erro ao enviar checklist");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-4">
        <XCircle className="h-16 w-16 text-destructive" />
        <h1 className="text-xl font-bold">Link Inválido</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  function shareResultWhatsApp(result: SubmitResult) {
    const nonConforming = result.total_items - result.conforming_items;
    const scoreEmoji = result.total_score >= 90 ? "🟢" : result.total_score >= 70 ? "🟡" : "🔴";
    const dateStr = format(new Date(), "dd/MM/yyyy");
    
    // Build list of non-conforming items
    const failedItems = Object.values(responses)
      .filter((r) => r.is_conforming === false)
      .map((r) => {
        const item = items.find((i) => i.id === r.template_item_id);
        return item ? `  ❌ ${item.item_text}${r.observation ? ` — _${r.observation}_` : ""}` : null;
      })
      .filter(Boolean);

    let text = `📋 *Checklist Diário — ${sectorDisplayName}*\n`;
    text += `🏪 ${result.loja_name} • ${dateStr}\n`;
    text += `👤 Aplicado por: ${respondedByName}\n\n`;
    text += `${scoreEmoji} *Nota: ${result.total_score.toFixed(0)}%*\n`;
    text += `✅ ${result.conforming_items} conformes | ❌ ${nonConforming} não conformes\n`;

    if (failedItems.length > 0) {
      text += `\n*Itens não conformes:*\n${failedItems.join("\n")}`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (submitResult) {
    const scoreColor = submitResult.total_score >= 90 ? "text-green-600" : submitResult.total_score >= 70 ? "text-yellow-600" : "text-red-600";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-6">
        <img src={logoImg} alt="Logo" className="h-16 object-contain" />
        <CheckCircle2 className="h-20 w-20 text-green-600" />
        <h1 className="text-2xl font-bold">Checklist Enviado!</h1>
        <div className={`text-5xl font-bold ${scoreColor}`}>
          {submitResult.total_score.toFixed(0)}%
        </div>
        <p className="text-lg font-medium">
          {sectorDisplayName} — {submitResult.loja_name}
        </p>
        <p className="text-muted-foreground">{format(new Date(), "dd/MM/yyyy")}</p>
        <div className="flex gap-8 text-sm">
          <div>
            <span className="font-bold text-green-600">{submitResult.conforming_items}</span>
            <span className="text-muted-foreground"> conformes</span>
          </div>
          <div>
            <span className="font-bold text-red-600">{submitResult.total_items - submitResult.conforming_items}</span>
            <span className="text-muted-foreground"> não conformes</span>
          </div>
        </div>
        
        <Button
          className="mt-4 gap-2 bg-green-600 hover:bg-green-700 text-white"
          onClick={() => shareResultWhatsApp(submitResult)}
        >
          <MessageCircle className="h-5 w-5" />
          Enviar Resultado por WhatsApp
        </Button>
        
        <p className="text-sm text-muted-foreground mt-2">Obrigado pela aplicação!</p>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-6">
        <img src={logoImg} alt="Logo" className="h-16 object-contain" />
        <CheckCircle2 className="h-16 w-16 text-green-600" />
        <h1 className="text-xl font-bold">Checklist já aplicado hoje</h1>
        {existingScore !== null && (
          <div className="text-4xl font-bold text-primary">{existingScore.toFixed(0)}%</div>
        )}
        <p className="text-muted-foreground">
          {sectorDisplayName} — {lojaName}<br />{today}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Logo" className="h-10 object-contain" />
          <div>
            <h1 className="text-lg font-bold uppercase">Checklist Diário — {sectorDisplayName}</h1>
            <p className="text-xs text-muted-foreground">{lojaName} • {today}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Name */}
        <div>
          <label className="text-sm font-medium mb-1 block">Seu nome</label>
          <Input
            placeholder="Nome de quem está aplicando"
            value={respondedByName}
            onChange={(e) => setRespondedByName(e.target.value)}
          />
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progresso: {answeredCount}/{items.length} itens</span>
            <span>{progressPercent.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Items */}
        <div className="space-y-3">
          {items.map((item, idx) => {
            const resp = responses[item.id];
            const isYes = resp?.is_conforming === true;
            const isNo = resp?.is_conforming === false;
            const showObs = expandedObs[item.id];

            return (
              <Card key={item.id} className="p-4 space-y-3">
                <div className="flex gap-2">
                  <span className="text-sm font-bold text-muted-foreground min-w-[28px]">{idx + 1}.</span>
                  <p className="text-sm font-medium flex-1">{item.item_text}</p>
                </div>

                {item.weight !== 1 && (
                  <span className="text-xs text-muted-foreground ml-8">Peso: {item.weight}</span>
                )}

                <div className="flex items-center gap-2 ml-8">
                  <Button
                    type="button"
                    size="sm"
                    variant={isYes ? "default" : "outline"}
                    className={`gap-1.5 ${isYes ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                    onClick={() => setAnswer(item.id, true)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    SIM
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isNo ? "default" : "outline"}
                    className={`gap-1.5 ${isNo ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                    onClick={() => setAnswer(item.id, false)}
                  >
                    <XCircle className="h-4 w-4" />
                    NÃO
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto gap-1"
                    onClick={() => toggleObs(item.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {showObs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>

                {showObs && (
                  <div className="ml-8">
                    <Textarea
                      placeholder="Observação (opcional)"
                      className="text-sm h-16"
                      value={resp?.observation || ""}
                      onChange={(e) => setObservation(item.id, e.target.value)}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Submit footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-lg mx-auto">
          <Button
            className="w-full gap-2 h-12 text-base"
            disabled={!allAnswered || !respondedByName.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            Enviar Checklist
          </Button>
        </div>
      </div>
    </div>
  );
}
