import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QrCode, Download, Copy, Check, Tablet, Smartphone, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PRODUCTION_URL = "https://freelancersgrupocaju.lovable.app";

interface Store {
  id: string;
  nome: string;
}

type Mode = "freelancer" | "estacao";

export function QRCodeGenerator() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<Mode>("freelancer");

  useEffect(() => {
    supabase.from("config_lojas").select("id, nome").order("nome").then(({ data }) => {
      if (data) setStores(data);
    });
  }, []);

  const targetUrl = (() => {
    if (!selectedStore) return "";
    if (mode === "estacao") return `${PRODUCTION_URL}/estacao-checkin?unidade=${selectedStore}`;
    return `${PRODUCTION_URL}/checkin?unidade=${selectedStore}`;
  })();

  const qrImageUrl = targetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = qrImageUrl;
    link.download = `qrcode-${mode}-${selectedStore}.png`;
    link.click();
  };

  const handleOpenInTab = () => {
    if (targetUrl) window.open(targetUrl, "_blank", "noopener");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="h-4 w-4" /> Gerador de QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="freelancer" className="gap-2">
              <Smartphone className="h-4 w-4" /> Celular do freelancer
            </TabsTrigger>
            <TabsTrigger value="estacao" className="gap-2">
              <Tablet className="h-4 w-4" /> Estação Tablet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="freelancer" className="mt-3">
            <p className="text-xs text-muted-foreground">
              Cada freelancer escaneia com o próprio celular para fazer check-in/out.
            </p>
          </TabsContent>
          <TabsContent value="estacao" className="mt-3">
            <p className="text-xs text-muted-foreground">
              Abra esse link no tablet fixado na unidade. Configure a estação uma única
              vez (escolha a loja + crie um PIN do gerente) e o tablet ficará travado nessa unidade.
            </p>
          </TabsContent>
        </Tabs>

        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedStore && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <img
                src={qrImageUrl}
                alt="QR Code"
                className="w-64 h-64 rounded-lg border border-border"
              />
            </div>

            <p className="text-xs text-muted-foreground text-center break-all">
              {targetUrl}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copiado!" : "Copiar Link"}
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" /> Baixar QR
              </Button>
              {mode === "estacao" && (
                <Button className="col-span-2" onClick={handleOpenInTab}>
                  <ExternalLink className="h-4 w-4 mr-1" /> Abrir Estação agora
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
