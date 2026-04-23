import { useState, useRef, useEffect } from "react";
import {
  Camera,
  CheckCircle,
  MapPin,
  DollarSign,
  User,
  Loader2,
  ArrowLeft,
  FlaskConical,
  RotateCcw,
  Clock,
  CalendarCheck,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Step = "cpf" | "register" | "confirm" | "selfie" | "value" | "done";
type Scenario = "novo" | "cadastrado" | "checkout" | "agendado";

interface MockProfile {
  id: string;
  cpf: string;
  nome_completo: string;
  telefone: string | null;
  foto_url: string | null;
  tipo_chave_pix: string | null;
  chave_pix: string | null;
}

const STEP_LABELS: Record<Step, string> = {
  cpf: "Identificação",
  register: "Cadastro",
  confirm: "Confirmação",
  selfie: "Selfie",
  value: "Valor",
  done: "Concluído",
};

const SCENARIO_LABELS: Record<Scenario, string> = {
  novo: "Freelancer novo",
  cadastrado: "Já cadastrado (1º check-in do dia)",
  checkout: "Com check-in em aberto (check-out)",
  agendado: "Agendado na escala (valor pré-preenchido)",
};

// Mock CPFs por cenário
const SCENARIO_CPFS: Record<Scenario, string> = {
  novo: "111.222.333-44",
  cadastrado: "222.333.444-55",
  checkout: "333.444.555-66",
  agendado: "444.555.666-77",
};

const MOCK_PROFILES: Record<string, MockProfile> = {
  "22233344455": {
    id: "mock-prof-1",
    cpf: "22233344455",
    nome_completo: "Maria Demo da Silva",
    telefone: "(11) 98888-1234",
    foto_url: null,
    tipo_chave_pix: "cpf",
    chave_pix: "22233344455",
  },
  "33344455566": {
    id: "mock-prof-2",
    cpf: "33344455566",
    nome_completo: "João Demo Pereira",
    telefone: "(11) 97777-4321",
    foto_url: null,
    tipo_chave_pix: "telefone",
    chave_pix: "(11) 97777-4321",
  },
  "44455566677": {
    id: "mock-prof-3",
    cpf: "44455566677",
    nome_completo: "Ana Demo Agendada",
    telefone: "(11) 96666-9999",
    foto_url: null,
    tipo_chave_pix: "email",
    chave_pix: "ana.demo@email.com",
  },
};

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
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

// Determina o cenário com base no CPF digitado (override do cenário inicial)
function detectScenarioFromCpf(cleanCpf: string): Scenario {
  if (cleanCpf.startsWith("111")) return "novo";
  if (cleanCpf.startsWith("222")) return "cadastrado";
  if (cleanCpf.startsWith("333")) return "checkout";
  if (cleanCpf.startsWith("444")) return "agendado";
  // default: trata como novo
  return "novo";
}

const STEP_ORDER: Step[] = ["cpf", "register", "confirm", "selfie", "value", "done"];

export default function FreelancerCheckinDemo() {
  // ===== Demo control state =====
  const [scenario, setScenario] = useState<Scenario>("novo");
  const [simulateGpsOff, setSimulateGpsOff] = useState(false);
  const [simulateCameraDenied, setSimulateCameraDenied] = useState(false);

  // ===== Flow state (espelhado do real) =====
  const [step, setStep] = useState<Step>("cpf");
  const [cpf, setCpf] = useState("");
  const [profile, setProfile] = useState<MockProfile | null>(null);
  const [isCheckout, setIsCheckout] = useState(false);
  const [isFromSchedule, setIsFromSchedule] = useState(false);
  const [openCheckinTime, setOpenCheckinTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const unitName = "Caju Limão - DEMO";

  // Registration fields
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPhotoBase64, setRegPhotoBase64] = useState<string | null>(null);
  const [regTipoChavePix, setRegTipoChavePix] = useState("");
  const [regChavePix, setRegChavePix] = useState("");

  // Selfie
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Geo (mocked)
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);

  // Valor
  const [valor, setValor] = useState("");

  // ===== Demo helpers =====
  const resetAll = () => {
    setStep("cpf");
    setCpf("");
    setProfile(null);
    setIsCheckout(false);
    setIsFromSchedule(false);
    setOpenCheckinTime(null);
    setRegName("");
    setRegPhone("");
    setRegPhotoBase64(null);
    setRegTipoChavePix("");
    setRegChavePix("");
    setSelfieBase64(null);
    setValor("");
    setIsLoading(false);
  };

  const applyScenarioPreset = (s: Scenario) => {
    resetAll();
    setScenario(s);
    setCpf(SCENARIO_CPFS[s]);
    toast.info(`Cenário aplicado: ${SCENARIO_LABELS[s]}`);
  };

  const jumpToStep = (target: Step) => {
    // Pré-popula dados mínimos para a etapa fazer sentido visualmente
    const cleanCpf = cpf.replace(/\D/g, "") || SCENARIO_CPFS[scenario].replace(/\D/g, "");
    const detected = detectScenarioFromCpf(cleanCpf);
    const mockProfile = MOCK_PROFILES[cleanCpf] ?? null;

    if (target !== "cpf") {
      setCpf(formatCpf(cleanCpf));
    }

    if (target === "register") {
      setProfile(null);
      setRegName(regName || "");
      setRegPhone(regPhone || "");
      setRegPhotoBase64(regPhotoBase64);
      setRegTipoChavePix(regTipoChavePix || "");
      setRegChavePix(regChavePix || "");
    }

    if (["confirm", "selfie", "value", "done"].includes(target)) {
      const p =
        mockProfile ?? {
          id: "mock-jump",
          cpf: cleanCpf,
          nome_completo: regName || "Demo Freelancer",
          telefone: regPhone || "(11) 99999-0000",
          foto_url: null,
          tipo_chave_pix: regTipoChavePix || "cpf",
          chave_pix: regChavePix || cleanCpf,
        };
      setProfile(p);
      setRegName(p.nome_completo);
      setRegPhone(p.telefone || "");
      setRegTipoChavePix(p.tipo_chave_pix || "");
      setRegChavePix(p.chave_pix || "");

      const checkout = detected === "checkout";
      setIsCheckout(checkout);
      setIsFromSchedule(detected === "agendado");
      setOpenCheckinTime(checkout ? "18:03" : null);
      if (detected === "agendado" && !valor) setValor("120");
    }
    setStep(target);
    toast.success(`Pulou para: ${STEP_LABELS[target]}`);
  };

  // Mock geo
  useEffect(() => {
    if (simulateGpsOff) {
      setGeo(null);
      return;
    }
    setGeo({ lat: -23.5505, lng: -46.6333 });
  }, [simulateGpsOff]);

  // ===== Handlers (espelhados, sem persistência) =====
  const handleFileCapture = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void,
  ) => {
    if (simulateCameraDenied) {
      toast.error("Câmera negada (simulação)");
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await readFileAsBase64(file);
      setter(base64);
    } catch {
      toast.error("Erro ao ler a foto.");
    }
    e.target.value = "";
  };

  const handleCpfSubmit = async () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("CPF deve ter 11 dígitos.");
      return;
    }

    // Reset
    setRegName("");
    setRegPhone("");
    setRegPhotoBase64(null);
    setRegTipoChavePix("");
    setRegChavePix("");
    setSelfieBase64(null);
    setProfile(null);
    setIsCheckout(false);
    setIsFromSchedule(false);
    setOpenCheckinTime(null);
    setValor("");

    setIsLoading(true);
    // pequena latência mockada para sentir o loading
    await new Promise((r) => setTimeout(r, 350));

    const detected = detectScenarioFromCpf(cleanCpf);
    const existing = MOCK_PROFILES[cleanCpf] ?? null;

    if (detected === "novo" || !existing) {
      setStep("register");
      setIsLoading(false);
      return;
    }

    setProfile(existing);
    setRegName(existing.nome_completo);
    setRegPhone(existing.telefone || "");
    setRegTipoChavePix(existing.tipo_chave_pix || "");
    setRegChavePix(existing.chave_pix || "");
    setRegPhotoBase64(existing.foto_url || null);

    if (detected === "checkout") {
      setIsCheckout(true);
      setOpenCheckinTime("18:03");
    } else if (detected === "agendado") {
      setIsFromSchedule(true);
      setValor("120");
    }
    setStep("confirm");
    setIsLoading(false);
  };

  const handleRegister = async () => {
    if (!regName.trim()) return toast.error("Nome é obrigatório.");
    if (!regPhotoBase64) return toast.error("Foto de perfil é obrigatória.");
    if (!regTipoChavePix) return toast.error("Tipo de chave Pix é obrigatório.");
    if (!regChavePix.trim()) return toast.error("Chave Pix é obrigatória.");

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const cleanCpf = cpf.replace(/\D/g, "");
    const newProfile: MockProfile = {
      id: "mock-new-" + Date.now(),
      cpf: cleanCpf,
      nome_completo: regName.trim(),
      telefone: regPhone.trim() || null,
      foto_url: regPhotoBase64,
      tipo_chave_pix: regTipoChavePix,
      chave_pix: regChavePix.trim(),
    };
    setProfile(newProfile);
    setIsCheckout(false);
    setStep("selfie");
    setIsLoading(false);
    toast.success("Cadastro concluído (DEMO — nada foi salvo)");
  };

  const handleConfirmProceed = async () => {
    if (!profile) return;
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 200));
    setIsLoading(false);
    setStep("selfie");
  };

  const handleSelfieCapture = async (base64: string) => {
    setSelfieBase64(base64);
    if (isCheckout) {
      await handleFinishCheckout();
    } else {
      setStep("value");
    }
  };

  const handleFinishCheckin = async () => {
    if (!selfieBase64 || !profile) return;
    const numericValor = parseFloat(valor.replace(",", "."));
    if (!numericValor || numericValor <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    setStep("done");
    setIsLoading(false);
    toast.success("Check-in registrado (DEMO — nada foi salvo)");
  };

  const handleFinishCheckout = async () => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    setStep("done");
    setIsLoading(false);
    toast.success("Check-out registrado (DEMO — nada foi salvo)");
  };

  // ===== Progress label =====
  const visibleSteps: Step[] = isCheckout
    ? ["cpf", "confirm", "selfie", "done"]
    : profile
      ? ["cpf", "confirm", "selfie", "value", "done"]
      : ["cpf", "register", "selfie", "value", "done"];
  const currentIndex = Math.max(0, visibleSteps.indexOf(step));
  const totalSteps = visibleSteps.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col items-center pb-8">
      {/* ===== DEMO CONTROL PANEL ===== */}
      <div className="w-full bg-amber-100 dark:bg-amber-950/40 border-b-2 border-amber-400 dark:border-amber-600 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-amber-500 text-white hover:bg-amber-500 gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              MODO DEMO
            </Badge>
            <span className="text-xs text-amber-900 dark:text-amber-200 font-medium">
              Nenhuma alteração será salva no banco
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-amber-900 dark:text-amber-200">Cenário</Label>
              <Select value={scenario} onValueChange={(v) => applyScenarioPreset(v as Scenario)}>
                <SelectTrigger className="bg-background h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCENARIO_LABELS) as Scenario[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SCENARIO_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-amber-900 dark:text-amber-200">
                Pular para etapa
              </Label>
              <Select value={step} onValueChange={(v) => jumpToStep(v as Step)}>
                <SelectTrigger className="bg-background h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEP_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STEP_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Button size="sm" variant="outline" onClick={resetAll} className="h-8 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reiniciar demo
            </Button>
            <label className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
              <Switch checked={simulateGpsOff} onCheckedChange={setSimulateGpsOff} />
              Simular GPS off
            </label>
            <label className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
              <Switch
                checked={simulateCameraDenied}
                onCheckedChange={setSimulateCameraDenied}
              />
              Simular câmera negada
            </label>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
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
          if (simulateCameraDenied) {
            toast.error("Câmera negada (simulação)");
            e.target.value = "";
            return;
          }
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

      <div className="w-full max-w-md space-y-4 px-4">
        {/* Header */}
        <div className="text-center pt-4 pb-2">
          <h1 className="text-xl font-bold text-foreground">
            {isCheckout ? "Check-out" : "Check-in"} Freelancer
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {unitName}
          </p>
          {step !== "done" && (
            <p className="text-xs text-muted-foreground mt-2">
              Etapa {currentIndex + 1} de {totalSteps} ·{" "}
              <span className="font-medium text-foreground">{STEP_LABELS[step]}</span>
            </p>
          )}
        </div>

        {/* Contextual messages */}
        {isFromSchedule && step !== "done" && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground flex items-start gap-2">
            <CalendarCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>
              Você é freelancer <strong>agendado</strong> para hoje. O valor da diária já
              vem preenchido conforme a escala.
            </span>
          </div>
        )}
        {isCheckout && openCheckinTime && step !== "done" && (
          <div className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-foreground flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <span>
              Você fez check-in às <strong>{openCheckinTime}</strong> — registre sua
              saída agora.
            </span>
          </div>
        )}

        {/* Step: CPF */}
        {step === "cpf" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identificação</CardTitle>
            </CardHeader>
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
              <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground">CPFs de teste (DEMO):</p>
                <p>
                  <span className="font-mono">111.xxx</span> → freelancer novo
                </p>
                <p>
                  <span className="font-mono">222.xxx</span> → já cadastrado
                </p>
                <p>
                  <span className="font-mono">333.xxx</span> → check-in em aberto
                </p>
                <p>
                  <span className="font-mono">444.xxx</span> → agendado na escala
                </p>
              </div>
              <Button
                onClick={handleCpfSubmit}
                disabled={isLoading}
                className="w-full"
              >
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
                <Input
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                />
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
                <Input
                  value={regChavePix}
                  onChange={(e) => setRegChavePix(e.target.value)}
                  placeholder="Sua chave Pix"
                />
              </div>

              <div className="space-y-2">
                <Label>Foto de Perfil *</Label>
                {regPhotoBase64 ? (
                  <div className="space-y-2">
                    <img
                      src={regPhotoBase64}
                      alt="Foto"
                      className="w-32 h-32 object-cover rounded-full mx-auto border-2 border-primary"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => profilePhotoRef.current?.click()}
                    >
                      <Camera className="h-4 w-4 mr-2" /> Tirar outra foto
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => profilePhotoRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" /> Tirar Foto de Perfil
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("cpf")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleRegister}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Cadastrar e Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && profile && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Confirme seus dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                {regPhotoBase64 ? (
                  <>
                    <img
                      src={regPhotoBase64}
                      alt="Foto"
                      className="w-20 h-20 rounded-full object-cover border-2 border-primary"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => profilePhotoRef.current?.click()}
                    >
                      <Camera className="h-3.5 w-3.5 mr-1" /> Trocar foto
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => profilePhotoRef.current?.click()}
                    >
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
                <Input
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                />
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
                <Input
                  value={regChavePix}
                  onChange={(e) => setRegChavePix(e.target.value)}
                  placeholder="Sua chave Pix"
                />
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
                <Button
                  onClick={handleConfirmProceed}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isCheckout ? "Fazer Check-out" : "Fazer Check-in"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Selfie */}
        {step === "selfie" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isCheckout ? "Selfie de Saída" : "Selfie de Entrada"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Tire uma selfie para confirmar sua{" "}
                {isCheckout ? "saída" : "presença"}.
              </p>

              {selfieBase64 ? (
                <div className="space-y-2">
                  <img src={selfieBase64} alt="Selfie" className="w-full rounded-lg" />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelfieBase64(null);
                      selfieInputRef.current?.click();
                    }}
                  >
                    <Camera className="h-4 w-4 mr-2" /> Tirar outra
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-full aspect-[4/3] rounded-lg bg-muted flex flex-col items-center justify-center gap-3">
                    <Camera className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Toque no botão abaixo para abrir a câmera
                    </p>
                  </div>
                  <Button
                    onClick={() => selfieInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    {isCheckout
                      ? "Tirar Selfie e Registrar Saída"
                      : "Tirar Selfie"}
                  </Button>
                </div>
              )}

              {geo ? (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <MapPin className="h-3 w-3" /> Localização capturada
                </p>
              ) : (
                <p className="text-xs text-destructive text-center flex items-center justify-center gap-1">
                  <MapPin className="h-3 w-3" /> Localização indisponível
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Value */}
        {step === "value" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Valor do Serviço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Informe o valor que espera receber por este serviço. O gestor irá
                confirmar antes do pagamento.
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
                {isFromSchedule && (
                  <p className="text-xs text-muted-foreground">
                    Valor pré-preenchido conforme escala (R$ 120,00).
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("selfie");
                    setSelfieBase64(null);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleFinishCheckin}
                  disabled={isLoading}
                  className="flex-1"
                >
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
              <Button variant="outline" onClick={resetAll} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Rodar demo novamente
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
