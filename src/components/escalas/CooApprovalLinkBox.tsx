import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Copy, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  templateId: string;
  setor: string;
  semanaLabel: string;
  unidadeNome: string;
};

function genToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function CooApprovalLinkBox({ templateId, setor, semanaLabel, unidadeNome }: Props) {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const gerarLink = async () => {
    setLoading(true);
    try {
      const token = genToken();
      const { error } = await supabase
        .from("escala_aprovacao_links")
        .insert({ template_id: templateId, token });
      if (error) throw error;
      const url = `https://freelancersgrupocaju.lovable.app/aprovar-escala/${token}`;
      setLink(url);
      toast.success("Link de aprovação gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar link");
    } finally {
      setLoading(false);
    }
  };

  const copiar = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };

  const enviarWhatsapp = () => {
    if (!link) return;
    const texto =
      `*Aprovação de Escala — ${unidadeNome}*\n` +
      `Setor: ${setor}\n` +
      `Semana: ${semanaLabel}\n\n` +
      `Por favor revisar e aprovar:\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          Enviar para o COO
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!link ? (
          <Button onClick={gerarLink} disabled={loading} className="w-full md:w-auto">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Gerar link de aprovação
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={link} readOnly className="font-mono text-xs" />
              <Button variant="outline" onClick={copiar} className="shrink-0">
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
              <Button onClick={enviarWhatsapp} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Link válido por 7 dias. O COO pode aprovar ou solicitar revisão direto pelo celular, sem precisar fazer login.
            </p>
            <Button variant="ghost" size="sm" onClick={gerarLink} disabled={loading}>
              Gerar novo link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
