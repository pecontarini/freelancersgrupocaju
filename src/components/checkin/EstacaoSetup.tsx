import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EstacaoCpfKeypad } from "./EstacaoCpfKeypad";

interface Loja {
  id: string;
  nome: string;
}

export interface EstacaoSession {
  lojaId: string;
  lojaNome: string;
  stationId: string;
}

interface Props {
  onReady: (session: EstacaoSession) => void;
}

const STORAGE_KEY = "estacao-checkin:session";

export function EstacaoSetup({ onReady }: Props) {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaId, setLojaId] = useState("");
  const [mode, setMode] = useState<"choose" | "create" | "verify">("choose");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [stationName, setStationName] = useState("Estação Principal");
  const [loading, setLoading] = useState(false);
  const [stationExists, setStationExists] = useState<boolean | null>(null);

  // Load lojas
  useEffect(() => {
    supabase
      .from("config_lojas")
      .select("id, nome")
      .order("nome")
      .then(({ data, error }) => {
        if (error) {
          toast.error("Erro ao carregar unidades");
        } else {
          setLojas(data || []);
          // Auto-select unidade from URL ?unidade=
          try {
            const params = new URLSearchParams(window.location.search);
            const fromUrl = params.get("unidade");
            if (fromUrl && (data || []).some((l) => l.id === fromUrl)) {
              setLojaId(fromUrl);
            }
          } catch {}
        }
      });
  }, []);

  // Check if station exists for selected loja
  useEffect(() => {
    if (!lojaId) {
      setStationExists(null);
      return;
    }
    supabase
      .from("checkin_stations")
      .select("id")
      .eq("loja_id", lojaId)
      .maybeSingle()
      .then(({ data }) => {
        setStationExists(!!data);
      });
  }, [lojaId]);

  const callPinFn = async (action: "create" | "verify", pinValue: string) => {
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/verify-station-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            loja_id: lojaId,
            pin: pinValue,
            station_name: stationName,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Erro ao processar PIN");
      }

      const loja = lojas.find((l) => l.id === lojaId);
      const session: EstacaoSession = {
        lojaId,
        lojaNome: loja?.nome ?? "",
        stationId: json.station_id,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      onReady(session);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (mode === "verify") {
    return (
      <EstacaoCpfKeypad
        title="Digite o PIN do gerente"
        digits={4}
        onCancel={() => setMode("choose")}
        onSubmit={(p) => callPinFn("verify", p)}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <MonitorSmartphone className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Estação de Check-in</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configure este tablet para uma unidade
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">Unidade</Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {lojas.map((l) => (
                  <SelectItem key={l.id} value={l.id} className="text-base py-3">
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {lojaId && stationExists === false && mode !== "create" && (
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm">
              <p className="font-medium mb-2">Esta unidade ainda não tem estação configurada.</p>
              <p className="text-muted-foreground">
                Crie um PIN de gerente (4 dígitos) para travar este tablet.
              </p>
              <Button className="w-full mt-3 h-12" onClick={() => setMode("create")}>
                <ShieldCheck className="h-4 w-4 mr-2" /> Criar PIN da estação
              </Button>
            </div>
          )}

          {lojaId && stationExists === true && mode !== "create" && (
            <div className="rounded-lg border border-accent/40 bg-accent/10 p-4">
              <p className="text-sm font-medium mb-2">Estação já configurada.</p>
              <Button className="w-full h-12" onClick={() => setMode("verify")}>
                <ShieldCheck className="h-4 w-4 mr-2" /> Desbloquear com PIN
              </Button>
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome da estação</Label>
                <Input
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  placeholder="Ex.: Tablet Recepção"
                />
              </div>
              <div className="space-y-2">
                <Label>PIN (4 dígitos)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="text-center text-2xl tracking-widest h-14"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirme o PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="text-center text-2xl tracking-widest h-14"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setMode("choose")}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 h-12"
                  disabled={loading || pin.length !== 4 || pin !== pinConfirm}
                  onClick={() => callPinFn("create", pin)}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Travar tablet"}
                </Button>
              </div>
              {pin && pinConfirm && pin !== pinConfirm && (
                <p className="text-xs text-destructive">Os PINs não coincidem.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function loadStoredEstacaoSession(): EstacaoSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EstacaoSession;
  } catch {
    return null;
  }
}

export function clearStoredEstacaoSession() {
  localStorage.removeItem(STORAGE_KEY);
}
