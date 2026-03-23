import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Download, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PRODUCTION_URL = "https://freelancersgrupocaju.lovable.app";

interface Store {
  id: string;
  nome: string;
}

export function QRCodeGenerator() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.from("config_lojas").select("id, nome").order("nome").then(({ data }) => {
      if (data) setStores(data);
    });
  }, []);

  const checkinUrl = selectedStore ? `${PRODUCTION_URL}/checkin?unidade=${selectedStore}` : "";

  // Generate QR Code using a free API
  const qrImageUrl = selectedStore
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkinUrl)}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = qrImageUrl;
    link.download = `qrcode-checkin-${selectedStore}.png`;
    link.click();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="h-4 w-4" /> Gerador de QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
              {checkinUrl}
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copiado!" : "Copiar Link"}
              </Button>
              <Button className="flex-1" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" /> Baixar QR
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
