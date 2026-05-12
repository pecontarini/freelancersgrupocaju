import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Seguranca() {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [mustReset, setMustReset] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("user_pins")
        .select("must_reset")
        .maybeSingle();
      setMustReset(!!data?.must_reset);
      setLoading(false);
    })();
  }, []);

  async function save() {
    const clean = pin.replace(/\D/g, "");
    if (clean.length < 4 || clean.length > 8) {
      toast.error("PIN deve ter entre 4 e 8 dígitos numéricos.");
      return;
    }
    if (clean !== confirm.replace(/\D/g, "")) {
      toast.error("PIN e confirmação não coincidem.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("set_user_pin", { p_pin: clean });
    setSaving(false);
    const res = data as { ok: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast.error("Falha: " + (error?.message ?? res?.error ?? "desconhecido"));
      return;
    }
    toast.success("PIN atualizado.");
    setPin(""); setConfirm(""); setMustReset(false);
  }

  if (loading) return <div className="container mx-auto p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="container mx-auto p-6 max-w-md">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Meu PIN de operações</CardTitle>
          </div>
          <CardDescription>
            Usado para autorizar overrides consultivos (ex: orçamento, extras) na publicação de escalas.
            4 a 8 dígitos numéricos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mustReset && (
            <div className="flex items-start gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>Seu PIN está com valor temporário (0000). Cadastre um PIN definitivo agora.</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="pin">Novo PIN</Label>
            <Input id="pin" type="password" inputMode="numeric" maxLength={8}
              value={pin} onChange={(e) => setPin(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar</Label>
            <Input id="confirm" type="password" inputMode="numeric" maxLength={8}
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar PIN
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
