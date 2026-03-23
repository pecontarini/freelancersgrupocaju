import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, CheckCircle, MapPin, DollarSign, User, Loader2, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFreelancerProfiles, FreelancerProfile } from "@/hooks/useFreelancerProfiles";
import { useFreelancerCheckins } from "@/hooks/useFreelancerCheckins";
import { useCpfLookup } from "@/hooks/useCpfLookup";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Step = "cpf" | "register" | "confirm" | "selfie" | "value" | "done";

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FreelancerCheckin() {
  const [searchParams] = useSearchParams();
  const unidadeId = searchParams.get("unidade");

  const [step, setStep] = useState<Step>("cpf");
  const [cpf, setCpf] = useState("");
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [isCheckout, setIsCheckout] = useState(false);
  const [openCheckinId, setOpenCheckinId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unitName, setUnitName] = useState("");

  // Registration fields
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPhotoBase64, setRegPhotoBase64] = useState<string | null>(null);
  const [regTipoChavePix, setRegTipoChavePix] = useState("");
  const [regChavePix, setRegChavePix] = useState("");

  // Selfie capture (native file input)
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Geolocation
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);

  // Value
  const [valor, setValor] = useState("");

  const { lookupByCpf, createProfile, updateProfile } = useFreelancerProfiles();
  const { findOpenCheckin, createCheckin, doCheckout } = useFreelancerCheckins();
  const { lookupFreelancerByCpf } = useCpfLookup();

  // Load unit name
  useEffect(() => {
    if (!unidadeId) return;
    supabase
      .from("config_lojas")
      .select("nome")
      .eq("id", unidadeId)
      .single()
      .then(({ data }) => {
        if (data) setUnitName(data.nome);
      });
  }, [unidadeId]);

  // Get geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Geolocation denied")
      );
    }
  }, []);

  const handleFileCapture = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await readFileAsBase64(file);
      setter(base64);
    } catch {
      toast.error("Erro ao ler a foto.");
    }
    // Reset input so re-selecting same file triggers onChange
    e.target.value = "";
  };

  const uploadPhoto = async (base64: string, folder: string): Promise<string> => {
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/checkin-upload-photo`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, fileName, folder }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Upload failed");
    return json.url;
  };

  // Step handlers
  const handleCpfSubmit = async () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("CPF deve ter 11 dígitos.");
      return;
    }
    if (!unidadeId) {
      toast.error("Unidade não identificada no QR Code.");
      return;
    }

    // Reset all state to avoid stale data
    setRegName("");
    setRegPhone("");
    setRegPhotoBase64(null);
    setRegTipoChavePix("");
    setRegChavePix("");
    setSelfieBase64(null);
    setProfile(null);
    setIsCheckout(false);
    setOpenCheckinId(null);

    setIsLoading(true);
    try {
      const existing = await lookupByCpf(cpf);
      if (existing) {
        setProfile(existing);
        // Pre-fill editable fields with existing data
        setRegName(existing.nome_completo);
        setRegPhone(existing.telefone || "");
        setRegTipoChavePix(existing.tipo_chave_pix || "");
        setRegChavePix(existing.chave_pix || "");
        setRegPhotoBase64(existing.foto_url || null);
        const today = format(new Date(), "yyyy-MM-dd");
        const open = await findOpenCheckin(existing.id, unidadeId, today);
        if (open) {
          setIsCheckout(true);
          setOpenCheckinId(open.id);
        } else {
          setIsCheckout(false);
        }
        setStep("confirm");
      } else {
        // No profile yet — try to pre-fill from freelancer_entries (budget history)
        const legacy = await lookupFreelancerByCpf(cpf);
        if (legacy) {
          setRegName(legacy.nome_completo);
          setRegChavePix(legacy.chave_pix || "");
        }
        setStep("register");
      }
    } catch (err: any) {
      toast.error("Erro ao buscar CPF: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regName.trim()) { toast.error("Nome é obrigatório."); return; }
    if (!regPhotoBase64) { toast.error("Foto de perfil é obrigatória."); return; }
    if (!regTipoChavePix) { toast.error("Tipo de chave Pix é obrigatório."); return; }
    if (!regChavePix.trim()) { toast.error("Chave Pix é obrigatória."); return; }

    setIsLoading(true);
    try {
      const fotoUrl = await uploadPhoto(regPhotoBase64, "profiles");
      const newProfile = await createProfile.mutateAsync({
        cpf,
        nome_completo: regName.trim(),
        telefone: regPhone.trim() || undefined,
        foto_url: fotoUrl,
        tipo_chave_pix: regTipoChavePix,
        chave_pix: regChavePix.trim(),
      });
      setProfile(newProfile);
      setIsCheckout(false);
      setStep("selfie");
    } catch (err: any) {
      toast.error("Erro ao cadastrar: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmProceed = async () => {
    if (!profile) return;
    
    // Check if any data changed
    const nameChanged = regName.trim() !== profile.nome_completo;
    const phoneChanged = (regPhone.trim() || null) !== (profile.telefone || null);
    const tipoPixChanged = (regTipoChavePix || null) !== (profile.tipo_chave_pix || null);
    const chavePixChanged = (regChavePix.trim() || null) !== (profile.chave_pix || null);
    const photoChanged = regPhotoBase64 !== profile.foto_url && regPhotoBase64 !== null && !regPhotoBase64.startsWith("http");
    
    const hasChanges = nameChanged || phoneChanged || tipoPixChanged || chavePixChanged || photoChanged;
    
    if (hasChanges) {
      setIsLoading(true);
      try {
        let newFotoUrl = profile.foto_url;
        if (photoChanged && regPhotoBase64) {
          newFotoUrl = await uploadPhoto(regPhotoBase64, "profiles");
        }
        const updated = await updateProfile.mutateAsync({
          id: profile.id,
          nome_completo: regName.trim(),
          telefone: regPhone.trim() || null,
          tipo_chave_pix: regTipoChavePix || null,
          chave_pix: regChavePix.trim() || null,
          foto_url: newFotoUrl,
        });
        setProfile(updated);
      } catch (err: any) {
        toast.error("Erro ao atualizar dados: " + err.message);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    
    setStep("selfie");
  };

  const handleSelfieCapture = async (base64: string) => {
    setSelfieBase64(base64);
    if (isCheckout) {
      handleFinishCheckout(base64);
    } else {
      setStep("value");
    }
  };

  const handleFinishCheckin = async () => {
    if (!selfieBase64 || !profile || !unidadeId) return;
    const numericValor = parseFloat(valor.replace(",", "."));
    if (!numericValor || numericValor <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    setIsLoading(true);
    try {
      const selfieUrl = await uploadPhoto(selfieBase64, "checkins");
      await createCheckin.mutateAsync({
        freelancer_id: profile.id,
        loja_id: unidadeId,
        checkin_selfie_url: selfieUrl,
        checkin_lat: geo?.lat,
        checkin_lng: geo?.lng,
        valor_informado: numericValor,
      });
      setStep("done");
      toast.success("Check-in registrado com sucesso!");
    } catch (err: any) {
      toast.error("Erro no check-in: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishCheckout = async (photo: string) => {
    if (!openCheckinId) return;
    setIsLoading(true);
    try {
      const selfieUrl = await uploadPhoto(photo, "checkouts");
      await doCheckout.mutateAsync({
        checkinId: openCheckinId,
        checkout_selfie_url: selfieUrl,
        checkout_lat: geo?.lat,
        checkout_lng: geo?.lng,
      });
      setStep("done");
      toast.success("Check-out registrado com sucesso!");
    } catch (err: any) {
      toast.error("Erro no check-out: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!unidadeId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive font-medium">QR Code inválido. Unidade não identificada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col items-center p-4">
      {/* Hidden native file inputs for camera capture */}
      <input
        type="file"
        accept="image/*"
        capture="user"
        hidden
        ref={profilePhotoRef}
        onChange={(e) => handleFileCapture(e, setRegPhotoBase64)}
      />
      <input
        type="file"
        accept="image/*"
        capture="user"
        hidden
        ref={selfieInputRef}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const base64 = await readFileAsBase64(file);
            handleSelfieCapture(base64);
          } catch {
            toast.error("Erro ao ler a selfie.");
          }
          e.target.value = "";
        }}
      />

      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center pt-4 pb-2">
          <h1 className="text-xl font-bold text-foreground">
            {isCheckout ? "Check-out" : "Check-in"} Freelancer
          </h1>
          {unitName && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {unitName}
            </p>
          )}
        </div>

        {/* Step: CPF */}
        {step === "cpf" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  inputMode="numeric"
                  maxLength={14}
                  autoFocus
                />
              </div>
              <Button onClick={handleCpfSubmit} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Register */}
        {step === "register" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cadastro de Freelancer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={cpf} disabled />
              </div>
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Chave Pix *</Label>
                <Select value={regTipoChavePix} onValueChange={setRegTipoChavePix}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave Pix *</Label>
                <Input value={regChavePix} onChange={(e) => setRegChavePix(e.target.value)} placeholder="Sua chave Pix" />
              </div>

              {/* Profile photo — native file capture */}
              <div className="space-y-2">
                <Label>Foto de Perfil *</Label>
                {regPhotoBase64 ? (
                  <div className="space-y-2">
                    <img src={regPhotoBase64} alt="Foto" className="w-32 h-32 object-cover rounded-full mx-auto border-2 border-primary" />
                    <Button variant="outline" size="sm" className="w-full" onClick={() => profilePhotoRef.current?.click()}>
                      <Camera className="h-4 w-4 mr-2" /> Tirar outra foto
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => profilePhotoRef.current?.click()}>
                    <Camera className="h-4 w-4 mr-2" /> Tirar Foto de Perfil
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("cpf")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button onClick={handleRegister} disabled={isLoading} className="flex-1">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Cadastrar e Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Confirm identity (editable) */}
        {step === "confirm" && profile && (
          <Card>
            <CardHeader><CardTitle className="text-base">Confirme seus dados</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Photo */}
              <div className="flex flex-col items-center gap-2">
                {regPhotoBase64 ? (
                  <>
                    <img src={regPhotoBase64} alt="Foto" className="w-20 h-20 rounded-full object-cover border-2 border-primary" />
                    <Button variant="ghost" size="sm" onClick={() => profilePhotoRef.current?.click()}>
                      <Camera className="h-3.5 w-3.5 mr-1" /> Trocar foto
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => profilePhotoRef.current?.click()}>
                      <Camera className="h-3.5 w-3.5 mr-1" /> Adicionar foto
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={regName} onChange={(e) => setRegName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={cpf} disabled />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Chave Pix</Label>
                <Select value={regTipoChavePix} onValueChange={setRegTipoChavePix}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave Pix</Label>
                <Input value={regChavePix} onChange={(e) => setRegChavePix(e.target.value)} placeholder="Sua chave Pix" />
              </div>

              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-sm font-medium">
                  {isCheckout
                    ? "Você tem um check-in em aberto. Vamos registrar sua saída."
                    : "Confira ou atualize seus dados antes de prosseguir."}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("cpf")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button onClick={handleConfirmProceed} disabled={isLoading} className="flex-1">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isCheckout ? "Fazer Check-out" : "Fazer Check-in"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Selfie — native file capture */}
        {step === "selfie" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isCheckout ? "Selfie de Saída" : "Selfie de Entrada"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Tire uma selfie para confirmar sua {isCheckout ? "saída" : "presença"}.
              </p>

              {selfieBase64 ? (
                <div className="space-y-2">
                  <img src={selfieBase64} alt="Selfie" className="w-full rounded-lg" />
                  <Button variant="outline" className="w-full" onClick={() => { setSelfieBase64(null); selfieInputRef.current?.click(); }}>
                    <Camera className="h-4 w-4 mr-2" /> Tirar outra
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-full aspect-[4/3] rounded-lg bg-muted flex flex-col items-center justify-center gap-3">
                    <Camera className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Toque no botão abaixo para abrir a câmera</p>
                  </div>
                  <Button
                    onClick={() => selfieInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                    {isCheckout ? "Tirar Selfie e Registrar Saída" : "Tirar Selfie"}
                  </Button>
                </div>
              )}

              {geo && (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <MapPin className="h-3 w-3" /> Localização capturada
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Value */}
        {step === "value" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Valor do Serviço</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Informe o valor que espera receber por este serviço. O gestor irá confirmar antes do pagamento.
              </p>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    inputMode="decimal"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep("selfie"); setSelfieBase64(null); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button onClick={handleFinishCheckin} disabled={isLoading} className="flex-1">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Confirmar Check-in
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isCheckout ? "Check-out Realizado!" : "Check-in Realizado!"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isCheckout
                    ? "Sua saída foi registrada. Aguarde a validação do gestor."
                    : "Sua presença foi registrada. Lembre-se de fazer check-out ao sair."}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
