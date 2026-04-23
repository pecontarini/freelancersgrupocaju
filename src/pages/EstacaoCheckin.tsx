import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  LogOut,
  MapPin,
  UserPlus,
  CheckCircle2,
  ArrowLeft,
  Clock,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import {
  EstacaoSetup,
  EstacaoSession,
  loadStoredEstacaoSession,
  clearStoredEstacaoSession,
} from "@/components/checkin/EstacaoSetup";
import { EstacaoFreelancerCard } from "@/components/checkin/EstacaoFreelancerCard";
import { EstacaoSelfieCapture } from "@/components/checkin/EstacaoSelfieCapture";
import { EstacaoCpfKeypad } from "@/components/checkin/EstacaoCpfKeypad";
import {
  useEstacaoStatus,
  EstacaoFreelancerItem,
} from "@/hooks/useEstacaoStatus";
import { useFreelancerProfiles } from "@/hooks/useFreelancerProfiles";
import { useFreelancerCheckins } from "@/hooks/useFreelancerCheckins";
import { useCpfLookup } from "@/hooks/useCpfLookup";

type Flow =
  | { kind: "home" }
  | { kind: "checkin"; item: EstacaoFreelancerItem }
  | { kind: "checkout"; item: EstacaoFreelancerItem }
  | { kind: "walkin-cpf" }
  | { kind: "walkin-register"; cpf: string }
  | { kind: "walkin-checkin"; profileId: string; suggestedValor?: number }
  | { kind: "switch-pin" }
  | { kind: "success"; message: string };

const formatBRL = (n?: number | null) =>
  n != null ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

function uploadPhotoBase64(base64: string, folder: string): Promise<string> {
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return fetch(
    `https://${projectId}.supabase.co/functions/v1/checkin-upload-photo`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, fileName, folder }),
    }
  )
    .then((r) => r.json())
    .then((j) => {
      if (!j.url) throw new Error(j.error || "Falha no upload");
      return j.url as string;
    });
}

export default function EstacaoCheckin() {
  const [session, setSession] = useState<EstacaoSession | null>(() =>
    loadStoredEstacaoSession()
  );
  const [now, setNow] = useState(new Date());
  const [flow, setFlow] = useState<Flow>({ kind: "home" });
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // walk-in registration form state
  const [regName, setRegName] = useState("");
  const [regTipoPix, setRegTipoPix] = useState("");
  const [regChavePix, setRegChavePix] = useState("");
  const [regValor, setRegValor] = useState("120");

  // checkin valor input
  const [valorInput, setValorInput] = useState("");

  const today = format(now, "yyyy-MM-dd");

  const { items, isLoading } = useEstacaoStatus(session?.lojaId, today);
  const { lookupByCpf, createProfile } = useFreelancerProfiles();
  const { findOpenCheckin, createCheckin, doCheckout } = useFreelancerCheckins(
    session?.lojaId,
    today
  );
  const { lookupFreelancerByCpf } = useCpfLookup();

  // Tick clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Geo at boot
  useEffect(() => {
    if (!session) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {}
      );
    }
  }, [session]);

  // Heartbeat (last_seen)
  useEffect(() => {
    if (!session) return;
    const ping = () =>
      supabase
        .from("checkin_stations")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", session.stationId)
        .then(() => {});
    ping();
    const t = setInterval(ping, 5 * 60_000);
    return () => clearInterval(t);
  }, [session]);

  // Counters
  const counts = useMemo(() => {
    let available = 0,
      inService = 0,
      done = 0;
    for (const i of items) {
      if (i.status === "available") available++;
      else if (i.status === "in_service") inService++;
      else done++;
    }
    return { available, inService, done, total: items.length };
  }, [items]);

  if (!session) {
    return <EstacaoSetup onReady={setSession} />;
  }

  // ---- Card click ----
  const onCardClick = (item: EstacaoFreelancerItem) => {
    if (item.status === "done") {
      toast.info("Este freelancer já concluiu o turno hoje.");
      return;
    }
    if (item.status === "in_service") {
      setFlow({ kind: "checkout", item });
    } else {
      setValorInput(item.agreedRate ? String(item.agreedRate) : "120");
      setFlow({ kind: "checkin", item });
    }
  };

  // ---- Check-in for scheduled/manual ----
  const finalizeCheckin = async (item: EstacaoFreelancerItem, selfieBase64: string) => {
    if (!session) return;
    const numericValor = parseFloat(valorInput.replace(",", "."));
    if (!numericValor || numericValor <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setBusy(true);
    try {
      const selfieUrl = await uploadPhotoBase64(selfieBase64, "checkins");

      // If a pending stub exists for this freelancer/loja/today, update it
      let pendingId: string | null = null;
      if (item.freelancerId) {
        const { data: pending } = await supabase
          .from("freelancer_checkins")
          .select("id")
          .eq("freelancer_id", item.freelancerId)
          .eq("loja_id", session.lojaId)
          .eq("checkin_date", today)
          .eq("status", "pending_schedule")
          .maybeSingle();
        pendingId = pending?.id ?? null;
      } else if (item.cpf) {
        const cleanCpf = item.cpf.replace(/\D/g, "");
        const { data: profile } = await supabase
          .from("freelancer_profiles")
          .select("id")
          .eq("cpf", cleanCpf)
          .maybeSingle();
        if (profile) {
          const { data: pending } = await supabase
            .from("freelancer_checkins")
            .select("id")
            .eq("freelancer_id", profile.id)
            .eq("loja_id", session.lojaId)
            .eq("checkin_date", today)
            .eq("status", "pending_schedule")
            .maybeSingle();
          pendingId = pending?.id ?? null;
        }
      }

      if (pendingId) {
        const { error } = await supabase
          .from("freelancer_checkins")
          .update({
            checkin_selfie_url: selfieUrl,
            checkin_at: new Date().toISOString(),
            checkin_lat: geo?.lat,
            checkin_lng: geo?.lng,
            valor_informado: numericValor,
            status: "open",
            station_id: session.stationId,
          })
          .eq("id", pendingId);
        if (error) throw error;
      } else {
        // No pending stub — must have freelancerId resolved
        let freelancerId = item.freelancerId;
        if (!freelancerId && item.cpf) {
          const profile = await lookupByCpf(item.cpf);
          freelancerId = profile?.id ?? null;
        }
        if (!freelancerId) {
          throw new Error("Cadastro do freelancer não encontrado. Use 'Não estou na lista'.");
        }
        await createCheckin.mutateAsync({
          freelancer_id: freelancerId,
          loja_id: session.lojaId,
          checkin_selfie_url: selfieUrl,
          checkin_lat: geo?.lat,
          checkin_lng: geo?.lng,
          valor_informado: numericValor,
        });
        // attach station_id afterwards
        await supabase
          .from("freelancer_checkins")
          .update({ station_id: session.stationId })
          .eq("freelancer_id", freelancerId)
          .eq("loja_id", session.lojaId)
          .eq("checkin_date", today)
          .eq("status", "open");
      }

      setFlow({ kind: "success", message: `Check-in de ${item.name} realizado!` });
      setTimeout(() => setFlow({ kind: "home" }), 4000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- Check-out ----
  const finalizeCheckout = async (item: EstacaoFreelancerItem, selfieBase64: string) => {
    if (!session || !item.checkinId) return;
    setBusy(true);
    try {
      const selfieUrl = await uploadPhotoBase64(selfieBase64, "checkouts");
      await doCheckout.mutateAsync({
        checkinId: item.checkinId,
        checkout_selfie_url: selfieUrl,
        checkout_lat: geo?.lat,
        checkout_lng: geo?.lng,
      });
      setFlow({ kind: "success", message: `Check-out de ${item.name} registrado!` });
      setTimeout(() => setFlow({ kind: "home" }), 4000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- Walk-in CPF flow ----
  const handleWalkinCpf = async (rawCpf: string) => {
    if (!session) return;
    const cpf = rawCpf.replace(/\D/g, "");
    if (cpf.length !== 11) {
      toast.error("CPF inválido");
      return;
    }
    setBusy(true);
    try {
      const profile = await lookupByCpf(cpf);
      if (profile) {
        // Already checked in? -> checkout flow
        const open = await findOpenCheckin(profile.id, session.lojaId, today);
        if (open) {
          setFlow({
            kind: "checkout",
            item: {
              key: `walkin:${open.id}`,
              source: "walkin",
              status: "in_service",
              scheduleId: null,
              entryId: null,
              checkinId: open.id,
              freelancerId: profile.id,
              name: profile.nome_completo,
              cpf: profile.cpf,
              jobTitle: null,
              startTime: null,
              endTime: null,
              agreedRate: open.valor_informado,
              fotoUrl: profile.foto_url,
              checkedInAt: open.checkin_at,
              checkedOutAt: null,
            },
          });
          return;
        }
        // Try to suggest valor from a pending stub if exists
        const { data: pending } = await supabase
          .from("freelancer_checkins")
          .select("valor_informado")
          .eq("freelancer_id", profile.id)
          .eq("loja_id", session.lojaId)
          .eq("checkin_date", today)
          .eq("status", "pending_schedule")
          .maybeSingle();
        setValorInput(
          pending?.valor_informado ? String(pending.valor_informado) : "120"
        );
        setFlow({
          kind: "walkin-checkin",
          profileId: profile.id,
          suggestedValor: pending?.valor_informado ?? undefined,
        });
      } else {
        // pre-fill from legacy
        const legacy = await lookupFreelancerByCpf(cpf);
        setRegName(legacy?.nome_completo ?? "");
        setRegChavePix(legacy?.chave_pix ?? "");
        setRegTipoPix("");
        setRegValor("120");
        setFlow({ kind: "walkin-register", cpf });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleWalkinRegisterAndCheckin = async (selfieBase64: string) => {
    if (!session || flow.kind !== "walkin-register") return;
    if (!regName.trim() || !regTipoPix || !regChavePix.trim()) {
      toast.error("Preencha nome, tipo e chave Pix.");
      return;
    }
    const numericValor = parseFloat(regValor.replace(",", "."));
    if (!numericValor || numericValor <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setBusy(true);
    try {
      const selfieUrl = await uploadPhotoBase64(selfieBase64, "checkins");
      const profile = await createProfile.mutateAsync({
        cpf: flow.cpf,
        nome_completo: regName.trim(),
        tipo_chave_pix: regTipoPix,
        chave_pix: regChavePix.trim(),
        foto_url: selfieUrl, // reuse selfie as profile photo for first registration
      });
      await createCheckin.mutateAsync({
        freelancer_id: profile.id,
        loja_id: session.lojaId,
        checkin_selfie_url: selfieUrl,
        checkin_lat: geo?.lat,
        checkin_lng: geo?.lng,
        valor_informado: numericValor,
      });
      await supabase
        .from("freelancer_checkins")
        .update({ station_id: session.stationId })
        .eq("freelancer_id", profile.id)
        .eq("loja_id", session.lojaId)
        .eq("checkin_date", today)
        .eq("status", "open");

      setFlow({
        kind: "success",
        message: `Cadastro e check-in de ${profile.nome_completo} concluídos!`,
      });
      setTimeout(() => setFlow({ kind: "home" }), 4000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleWalkinCheckin = async (selfieBase64: string) => {
    if (!session || flow.kind !== "walkin-checkin") return;
    const numericValor = parseFloat(valorInput.replace(",", "."));
    if (!numericValor || numericValor <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setBusy(true);
    try {
      const selfieUrl = await uploadPhotoBase64(selfieBase64, "checkins");
      // try pending stub first
      const { data: pending } = await supabase
        .from("freelancer_checkins")
        .select("id")
        .eq("freelancer_id", flow.profileId)
        .eq("loja_id", session.lojaId)
        .eq("checkin_date", today)
        .eq("status", "pending_schedule")
        .maybeSingle();
      if (pending) {
        const { error } = await supabase
          .from("freelancer_checkins")
          .update({
            checkin_selfie_url: selfieUrl,
            checkin_at: new Date().toISOString(),
            checkin_lat: geo?.lat,
            checkin_lng: geo?.lng,
            valor_informado: numericValor,
            status: "open",
            station_id: session.stationId,
          })
          .eq("id", pending.id);
        if (error) throw error;
      } else {
        await createCheckin.mutateAsync({
          freelancer_id: flow.profileId,
          loja_id: session.lojaId,
          checkin_selfie_url: selfieUrl,
          checkin_lat: geo?.lat,
          checkin_lng: geo?.lng,
          valor_informado: numericValor,
        });
        await supabase
          .from("freelancer_checkins")
          .update({ station_id: session.stationId })
          .eq("freelancer_id", flow.profileId)
          .eq("loja_id", session.lojaId)
          .eq("checkin_date", today)
          .eq("status", "open");
      }
      setFlow({ kind: "success", message: "Check-in registrado!" });
      setTimeout(() => setFlow({ kind: "home" }), 4000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- Switch unit (PIN-protected) ----
  const handleSwitchPin = async (pin: string) => {
    if (!session) return;
    setBusy(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/verify-station-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", loja_id: session.lojaId, pin }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "PIN incorreto");
      clearStoredEstacaoSession();
      setSession(null);
      setFlow({ kind: "home" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- Render flow overlays ----
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              {session.lojaNome}
            </h1>
            <p className="text-sm text-muted-foreground capitalize">
              {format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold tabular-nums">{format(now, "HH:mm")}</div>
            <div className="text-xs text-muted-foreground">
              {counts.inService} em serviço · {counts.available} aguardando · {counts.done} concluídos
            </div>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="max-w-7xl mx-auto px-6 py-6 pb-32">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-lg text-muted-foreground mb-2">
              Nenhum freelancer previsto para hoje.
            </p>
            <p className="text-sm text-muted-foreground">
              Use o botão "Não estou na lista" para freelancers avulsos.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <EstacaoFreelancerCard
                key={item.key}
                item={item}
                onClick={() => onCardClick(item)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl bg-background/90 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Button
            size="lg"
            variant="outline"
            className="h-14 text-base"
            onClick={() => setFlow({ kind: "switch-pin" })}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Trocar unidade
          </Button>

          <Button
            size="lg"
            className="h-16 text-lg px-10 flex-1 max-w-md"
            onClick={() => setFlow({ kind: "walkin-cpf" })}
          >
            <UserPlus className="h-6 w-6 mr-2" />
            Não estou na lista
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-14 text-base"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Atualizar
          </Button>
        </div>
      </footer>

      {/* === Flow overlays === */}

      {/* CHECK-IN: confirm value then selfie */}
      {flow.kind === "checkin" && (
        <CheckinConfirmOverlay
          item={flow.item}
          valorInput={valorInput}
          onValorChange={setValorInput}
          onCancel={() => setFlow({ kind: "home" })}
          onProceed={() => {
            // open selfie capture by transitioning state
            setFlow({ kind: "checkin", item: { ...flow.item, key: flow.item.key + ":selfie" } });
            // we just go straight into selfie below by checking key suffix
          }}
          onCapture={(b64) => finalizeCheckin(flow.item, b64)}
          busy={busy}
        />
      )}

      {/* CHECK-OUT */}
      {flow.kind === "checkout" && (
        <CheckoutOverlay
          item={flow.item}
          onCancel={() => setFlow({ kind: "home" })}
          onCapture={(b64) => finalizeCheckout(flow.item, b64)}
          busy={busy}
        />
      )}

      {/* WALK-IN CPF entry */}
      {flow.kind === "walkin-cpf" && (
        <EstacaoCpfKeypad
          title="Digite seu CPF"
          onCancel={() => setFlow({ kind: "home" })}
          onSubmit={handleWalkinCpf}
        />
      )}

      {/* WALK-IN: register new freelancer */}
      {flow.kind === "walkin-register" && (
        <WalkinRegisterOverlay
          cpf={flow.cpf}
          regName={regName}
          setRegName={setRegName}
          regTipoPix={regTipoPix}
          setRegTipoPix={setRegTipoPix}
          regChavePix={regChavePix}
          setRegChavePix={setRegChavePix}
          regValor={regValor}
          setRegValor={setRegValor}
          onCancel={() => setFlow({ kind: "home" })}
          onCapture={handleWalkinRegisterAndCheckin}
          busy={busy}
        />
      )}

      {/* WALK-IN: existing profile -> selfie + valor */}
      {flow.kind === "walkin-checkin" && (
        <WalkinCheckinOverlay
          valorInput={valorInput}
          setValorInput={setValorInput}
          onCancel={() => setFlow({ kind: "home" })}
          onCapture={handleWalkinCheckin}
          busy={busy}
        />
      )}

      {/* SWITCH UNIT */}
      {flow.kind === "switch-pin" && (
        <EstacaoCpfKeypad
          title="PIN do gerente para trocar unidade"
          digits={4}
          onCancel={() => setFlow({ kind: "home" })}
          onSubmit={handleSwitchPin}
        />
      )}

      {/* SUCCESS */}
      {flow.kind === "success" && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center gap-6 animate-in fade-in">
          <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-20 w-20 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-center px-6">{flow.message}</h2>
          <p className="text-muted-foreground">Voltando para a tela inicial...</p>
        </div>
      )}
    </div>
  );
}

/* -------------------- Sub overlays -------------------- */

function CheckinConfirmOverlay({
  item,
  valorInput,
  onValorChange,
  onCancel,
  onCapture,
  busy,
}: {
  item: EstacaoFreelancerItem;
  valorInput: string;
  onValorChange: (v: string) => void;
  onCancel: () => void;
  onProceed: () => void;
  onCapture: (b64: string) => void;
  busy: boolean;
}) {
  const [showCamera, setShowCamera] = useState(false);

  if (showCamera) {
    return (
      <EstacaoSelfieCapture
        title={`Check-in · ${item.name}`}
        onCancel={() => setShowCamera(false)}
        onCapture={onCapture}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 space-y-6">
          <Button variant="ghost" onClick={onCancel} size="lg">
            <ArrowLeft className="h-5 w-5 mr-2" /> Voltar
          </Button>

          <div className="flex items-center gap-4">
            {item.fotoUrl ? (
              <img
                src={item.fotoUrl}
                alt={item.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-primary"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-4 border-border">
                <UserPlus className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">É você?</p>
              <h2 className="text-2xl font-bold">{item.name}</h2>
              {item.jobTitle && (
                <p className="text-sm text-muted-foreground">{item.jobTitle}</p>
              )}
            </div>
          </div>

          {item.startTime && item.endTime && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário previsto: {item.startTime.slice(0, 5)} – {item.endTime.slice(0, 5)}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Valor combinado (R$)
            </Label>
            <Input
              inputMode="decimal"
              value={valorInput}
              onChange={(e) => onValorChange(e.target.value)}
              className="h-14 text-2xl text-center font-bold"
            />
          </div>

          <Button
            size="lg"
            className="w-full h-16 text-lg"
            disabled={busy}
            onClick={() => setShowCamera(true)}
          >
            Tirar selfie de check-in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckoutOverlay({
  item,
  onCancel,
  onCapture,
  busy,
}: {
  item: EstacaoFreelancerItem;
  onCancel: () => void;
  onCapture: (b64: string) => void;
  busy: boolean;
}) {
  const [showCamera, setShowCamera] = useState(false);

  if (showCamera) {
    return (
      <EstacaoSelfieCapture
        title={`Check-out · ${item.name}`}
        onCancel={() => setShowCamera(false)}
        onCapture={onCapture}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 space-y-6">
          <Button variant="ghost" onClick={onCancel} size="lg">
            <ArrowLeft className="h-5 w-5 mr-2" /> Voltar
          </Button>

          <div className="flex items-center gap-4">
            {item.fotoUrl ? (
              <img
                src={item.fotoUrl}
                alt={item.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-accent"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-4 border-border">
                <UserPlus className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold">{item.name}</h2>
              {item.checkedInAt && (
                <p className="text-sm text-muted-foreground">
                  Em serviço desde {format(new Date(item.checkedInAt), "HH:mm")}
                </p>
              )}
            </div>
          </div>

          <Button
            size="lg"
            className="w-full h-16 text-lg"
            disabled={busy}
            onClick={() => setShowCamera(true)}
          >
            Tirar selfie de check-out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function WalkinRegisterOverlay({
  cpf,
  regName,
  setRegName,
  regTipoPix,
  setRegTipoPix,
  regChavePix,
  setRegChavePix,
  regValor,
  setRegValor,
  onCancel,
  onCapture,
  busy,
}: {
  cpf: string;
  regName: string;
  setRegName: (v: string) => void;
  regTipoPix: string;
  setRegTipoPix: (v: string) => void;
  regChavePix: string;
  setRegChavePix: (v: string) => void;
  regValor: string;
  setRegValor: (v: string) => void;
  onCancel: () => void;
  onCapture: (b64: string) => void;
  busy: boolean;
}) {
  const [showCamera, setShowCamera] = useState(false);

  if (showCamera) {
    return (
      <EstacaoSelfieCapture
        title="Cadastro + Check-in"
        onCancel={() => setShowCamera(false)}
        onCapture={onCapture}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl flex items-center justify-center p-6 overflow-auto">
      <Card className="w-full max-w-xl my-6">
        <CardContent className="p-8 space-y-4">
          <Button variant="ghost" onClick={onCancel} size="lg">
            <ArrowLeft className="h-5 w-5 mr-2" /> Voltar
          </Button>

          <h2 className="text-2xl font-bold">Cadastro rápido</h2>
          <p className="text-sm text-muted-foreground">
            CPF não encontrado. Complete os dados abaixo para realizar o check-in.
          </p>

          <div className="space-y-3">
            <div>
              <Label>CPF</Label>
              <Input value={cpf} disabled />
            </div>
            <div>
              <Label>Nome completo *</Label>
              <Input value={regName} onChange={(e) => setRegName(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de chave Pix *</Label>
              <Select value={regTipoPix} onValueChange={setRegTipoPix}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chave Pix *</Label>
              <Input value={regChavePix} onChange={(e) => setRegChavePix(e.target.value)} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                inputMode="decimal"
                value={regValor}
                onChange={(e) => setRegValor(e.target.value)}
                className="h-12 text-xl text-center font-semibold"
              />
            </div>
          </div>

          <Button
            size="lg"
            className="w-full h-14 text-lg"
            disabled={busy || !regName.trim() || !regTipoPix || !regChavePix.trim()}
            onClick={() => setShowCamera(true)}
          >
            Tirar selfie e finalizar check-in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function WalkinCheckinOverlay({
  valorInput,
  setValorInput,
  onCancel,
  onCapture,
  busy,
}: {
  valorInput: string;
  setValorInput: (v: string) => void;
  onCancel: () => void;
  onCapture: (b64: string) => void;
  busy: boolean;
}) {
  const [showCamera, setShowCamera] = useState(false);

  if (showCamera) {
    return (
      <EstacaoSelfieCapture
        title="Check-in"
        onCancel={() => setShowCamera(false)}
        onCapture={onCapture}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 space-y-6">
          <Button variant="ghost" onClick={onCancel} size="lg">
            <ArrowLeft className="h-5 w-5 mr-2" /> Voltar
          </Button>

          <h2 className="text-2xl font-bold">Confirmar valor</h2>
          <div className="space-y-2">
            <Label className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Valor combinado (R$)
            </Label>
            <Input
              inputMode="decimal"
              value={valorInput}
              onChange={(e) => setValorInput(e.target.value)}
              className="h-14 text-2xl text-center font-bold"
            />
          </div>

          <Button
            size="lg"
            className="w-full h-16 text-lg"
            disabled={busy}
            onClick={() => setShowCamera(true)}
          >
            Tirar selfie de check-in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
