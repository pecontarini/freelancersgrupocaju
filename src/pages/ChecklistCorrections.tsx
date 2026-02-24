import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Loader2, Camera, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { SECTOR_POSITION_MAP, type AuditSector } from "@/lib/sectorPositionMapping";
import logoImg from "@/assets/grupo-caju-logo.png";

interface NCItem {
  id: string;
  observation: string | null;
  photo_url: string | null;
  checklist_template_items: { item_text: string; weight: number } | null;
  correction: {
    id: string;
    corrected_by_name: string;
    correction_photo_url: string;
    correction_note: string | null;
    corrected_at: string;
  } | null;
}

export default function ChecklistCorrections() {
  const { responseId, accessToken } = useParams<{ responseId: string; accessToken: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ncItems, setNcItems] = useState<NCItem[]>([]);
  const [lojaName, setLojaName] = useState("");
  const [sectorCode, setSectorCode] = useState("");
  const [responseDate, setResponseDate] = useState("");
  const [totalScore, setTotalScore] = useState(0);
  const [respondedByName, setRespondedByName] = useState("");
  const [correctorName, setCorrectorName] = useState("");
  const [submittingItem, setSubmittingItem] = useState<string | null>(null);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    fetchData();
  }, [responseId, accessToken]);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-checklist-correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch", response_id: responseId, access_token: accessToken }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Link inválido");
        return;
      }
      const { data } = json;
      setLojaName(data.loja_name);
      setSectorCode(data.sector_code);
      setResponseDate(data.response_date);
      setTotalScore(data.total_score);
      setRespondedByName(data.responded_by_name || "");
      setNcItems(data.nc_items);
    } catch {
      setError("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoUpload(itemId: string, file: File) {
    try {
      setUploadingItem(itemId);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-checklist-correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload-photo",
          access_token: accessToken,
          response_id: responseId,
          file_base64: base64,
          file_name: file.name,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Erro ao enviar foto");
        return;
      }

      setPhotoUrls((prev) => ({ ...prev, [itemId]: json.data.public_url }));
      toast.success("Foto anexada!");
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploadingItem(null);
    }
  }

  async function handleSubmitCorrection(itemId: string) {
    if (!correctorName.trim()) {
      toast.error("Informe seu nome antes de registrar a correção");
      return;
    }
    if (!photoUrls[itemId]) {
      toast.error("Anexe uma foto comprovando a correção");
      return;
    }

    try {
      setSubmittingItem(itemId);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-checklist-correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          access_token: accessToken,
          response_id: responseId,
          response_item_id: itemId,
          corrected_by_name: correctorName.trim(),
          correction_photo_url: photoUrls[itemId],
          correction_note: notes[itemId] || null,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Erro ao registrar correção");
        return;
      }

      toast.success("Correção registrada!");
      // Refresh data
      await fetchData();
    } catch {
      toast.error("Erro ao registrar correção");
    } finally {
      setSubmittingItem(null);
    }
  }

  const sectorDisplayName = SECTOR_POSITION_MAP[sectorCode as AuditSector]?.displayName || sectorCode;
  const correctedCount = ncItems.filter((i) => i.correction).length;
  const pendingCount = ncItems.length - correctedCount;

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

  if (ncItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-4">
        <CheckCircle2 className="h-16 w-16 text-green-600" />
        <h1 className="text-xl font-bold">Sem Não Conformidades</h1>
        <p className="text-muted-foreground">Todos os itens estão conformes.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b px-4 py-4">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-2">
          <img src={logoImg} alt="Logo" className="h-12 object-contain" />
          <h1 className="text-lg font-bold text-center">Correções de Não Conformidades</h1>
          <p className="text-sm text-muted-foreground text-center">
            {sectorDisplayName} — {lojaName}
          </p>
          {responseDate && (
            <p className="text-xs text-muted-foreground">
              Checklist de {format(new Date(responseDate + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
              {respondedByName && ` • Aplicado por ${respondedByName}`}
            </p>
          )}
          <div className="flex gap-3 mt-1">
            <Badge variant="destructive" className="text-xs">
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </Badge>
            {correctedCount > 0 && (
              <Badge className="text-xs bg-green-600">
                {correctedCount} corrigido{correctedCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Corrector name input (sticky) */}
      <div className="sticky top-0 z-10 bg-card border-b px-4 py-3">
        <div className="max-w-lg mx-auto">
          <label className="text-sm font-medium mb-1 block">Seu nome (responsável pelas correções)</label>
          <Input
            placeholder="Digite seu nome completo"
            value={correctorName}
            onChange={(e) => setCorrectorName(e.target.value)}
          />
        </div>
      </div>

      {/* Items list */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {ncItems.map((item) => {
          const isCorrected = !!item.correction;
          const itemText = item.checklist_template_items?.item_text || "Item";
          const hasPhoto = !!photoUrls[item.id];

          return (
            <Card key={item.id} className={`p-4 ${isCorrected ? "border-green-300 bg-green-50/50" : "border-red-200"}`}>
              {/* Item header */}
              <div className="flex items-start gap-2 mb-3">
                {isCorrected ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{itemText}</p>
                  {item.observation && (
                    <p className="text-xs text-muted-foreground mt-1">
                      💬 Observação: {item.observation}
                    </p>
                  )}
                  {item.photo_url && (
                    <a
                      href={item.photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-1 block"
                    >
                      📷 Ver foto da não conformidade
                    </a>
                  )}
                </div>
              </div>

              {/* Correction status */}
              {isCorrected ? (
                <div className="bg-green-100 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600 text-xs">Corrigido</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.correction!.corrected_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs">Por: <strong>{item.correction!.corrected_by_name}</strong></p>
                  {item.correction!.correction_note && (
                    <p className="text-xs text-muted-foreground">💬 {item.correction!.correction_note}</p>
                  )}
                  <a
                    href={item.correction!.correction_photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline block"
                  >
                    📷 Ver foto da correção
                  </a>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t">
                  {/* Photo upload */}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      ref={(el) => { fileInputRefs.current[item.id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(item.id, file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant={hasPhoto ? "default" : "outline"}
                      size="sm"
                      className={`w-full gap-2 ${!hasPhoto ? "border-red-300 text-red-600" : "bg-green-600 hover:bg-green-700"}`}
                      onClick={() => fileInputRefs.current[item.id]?.click()}
                      disabled={uploadingItem === item.id}
                    >
                      {uploadingItem === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {hasPhoto ? "✓ Foto anexada" : "Anexar foto da correção *"}
                    </Button>
                  </div>

                  {/* Optional note */}
                  <Textarea
                    placeholder="Observação sobre a correção (opcional)"
                    className="text-sm min-h-[60px]"
                    value={notes[item.id] || ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />

                  {/* Submit button */}
                  <Button
                    className="w-full gap-2"
                    disabled={!hasPhoto || !correctorName.trim() || submittingItem === item.id}
                    onClick={() => handleSubmitCorrection(item.id)}
                  >
                    {submittingItem === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Registrar Correção
                  </Button>
                </div>
              )}
            </Card>
          );
        })}

        {/* Summary footer */}
        {correctedCount === ncItems.length && (
          <div className="text-center py-6">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold">Todas as correções registradas!</h2>
            <p className="text-sm text-muted-foreground">
              {ncItems.length} item(ns) corrigido(s) com sucesso.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
