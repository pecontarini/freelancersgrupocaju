import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Link2,
  Search,
  CheckCircle2,
  Plus,
  Building2,
  Info,
  AlertCircle,
} from "lucide-react";
import { useEmployees, friendlyEmployeeError } from "@/hooks/useEmployees";
import { useUpsertSchedule } from "@/hooks/useManualSchedules";
import { useSectorJobTitles } from "@/hooks/useSectorJobTitles";
import { useJobTitles } from "@/hooks/useJobTitles";
import { useCpfLookup } from "@/hooks/useCpfLookup";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatCPF } from "@/lib/formatters";
import { isValidCpf, unmaskCpf } from "@/lib/cpf";
import { toast } from "sonner";
import { QuickCreateJobTitleDialog } from "./QuickCreateJobTitleDialog";

interface FreelancerAddModalProps {
  open: boolean;
  onClose: () => void;
  unitId: string;
  unitName?: string;
  sectorId: string;
  date: string;
  partnerUnitId?: string;
  partnerUnitName?: string;
  partnerSectorId?: string;
  sectors?: { id: string; name: string }[];
  onAdded?: (employeeId: string) => void;
}

export function FreelancerAddModal({
  open,
  onClose,
  unitId,
  unitName,
  sectorId,
  date,
  partnerUnitId,
  partnerUnitName,
  partnerSectorId,
  sectors = [],
  onAdded,
}: FreelancerAddModalProps) {
  const [chosenSectorId, setChosenSectorId] = useState<string>(sectorId);
  const isShared = !!partnerUnitId && !!partnerSectorId && chosenSectorId === sectorId;

  const [targetUnitId, setTargetUnitId] = useState<string>(unitId);
  const targetSectorId = isShared && targetUnitId === partnerUnitId ? partnerSectorId! : chosenSectorId;

  const { data: employees = [] } = useEmployees(unitId, isShared ? [partnerUnitId!] : undefined);
  const { data: sectorJobTitles = [] } = useSectorJobTitles(
    isShared ? [chosenSectorId, partnerSectorId!] : [chosenSectorId]
  );
  const { data: allJobTitles = [] } = useJobTitles(targetUnitId);
  const upsertSchedule = useUpsertSchedule();
  const { lookupUnifiedByCpf, isLookingUp } = useCpfLookup();
  const userProfile = useUserProfile();
  const canManageJobTitles = !!(userProfile?.isAdmin || userProfile?.isOperator || userProfile?.isGerenteUnidade);

  const [quickJobTitleOpen, setQuickJobTitleOpen] = useState(false);

  const allowedJobTitleIds = useMemo(
    () => new Set(sectorJobTitles.map((sjt) => sjt.job_title_id)),
    [sectorJobTitles]
  );

  const allowedJobTitles = useMemo(
    () => allJobTitles.filter((jt) => allowedJobTitleIds.has(jt.id)),
    [allJobTitles, allowedJobTitleIds]
  );

  // Form state — CPF obrigatório
  const [cpfValue, setCpfValue] = useState("");
  const [cpfTouched, setCpfTouched] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "">("");
  const [phone, setPhone] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("");
  const [selectedJobTitleId, setSelectedJobTitleId] = useState("");
  const [rate, setRate] = useState("120");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:20");

  const [filled, setFilled] = useState({ name: false, phone: false, pix: false, gender: false });

  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(null);
  const [linkedSourceLabel, setLinkedSourceLabel] = useState<string | null>(null);
  const [searchedCpf, setSearchedCpf] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    scheduleId: string;
    nome: string;
    telefone: string;
    inicio: string;
    fim: string;
  } | null>(null);


  useEffect(() => {
    if (open) {
      setChosenSectorId(sectorId);
      setTargetUnitId(unitId);
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unitId, sectorId]);

  useEffect(() => {
    setSelectedJobTitleId("");
  }, [chosenSectorId]);

  const isSaving = upsertSchedule.isPending;

  const findExistingEmployee = useCallback(
    (cleanCpf: string) => {
      return employees.find(
        (e: any) =>
          e.cpf &&
          e.cpf.replace(/\D/g, "") === cleanCpf &&
          e.unit_id === targetUnitId &&
          e.worker_type === "freelancer" &&
          e.active !== false
      );
    },
    [employees, targetUnitId]
  );

  const handleCpfChange = useCallback(
    async (rawValue: string) => {
      const formatted = formatCPF(rawValue);
      setCpfValue(formatted);
      const clean = formatted.replace(/\D/g, "");

      if (clean.length < 11) {
        setLinkedEmployeeId(null);
        setLinkedSourceLabel(null);
        setSearchedCpf("");
        return;
      }

      if (clean.length === 11 && clean !== searchedCpf) {
        setSearchedCpf(clean);
        if (!isValidCpf(clean)) return;

        const existing = findExistingEmployee(clean);
        if (existing) {
          setLinkedEmployeeId(existing.id);
          setLinkedSourceLabel("Freelancer já cadastrado — dados preenchidos automaticamente.");
          if (!name) setName(existing.name);
          if (!phone) setPhone(existing.phone || "");
          if (!gender && (existing.gender === "M" || existing.gender === "F")) {
            setGender(existing.gender);
            setFilled((f) => ({ ...f, gender: true }));
          }
          if (existing.job_title_id && allowedJobTitleIds.has(existing.job_title_id)) {
            setSelectedJobTitleId(existing.job_title_id);
          }
          if (existing.default_rate) setRate(String(existing.default_rate));
          setFilled((f) => ({
            ...f,
            name: true,
            phone: !!existing.phone,
          }));
          return;
        }

        const result = await lookupUnifiedByCpf(formatted);
        if (result) {
          setLinkedSourceLabel("Freelancer já cadastrado — dados preenchidos automaticamente.");
          if (!name) setName(result.nome_completo || "");
          if (!phone) setPhone(result.telefone || "");
          if (!pixKey) setPixKey(result.chave_pix || "");
          if (!pixType) setPixType(result.tipo_chave_pix || "");
          setFilled((f) => ({
            ...f,
            name: !!result.nome_completo,
            phone: !!result.telefone,
            pix: !!result.chave_pix,
          }));

          if (result.funcao) {
            const match = allowedJobTitles.find(
              (jt) => jt.name.toLowerCase() === result.funcao!.toLowerCase()
            );
            if (match) setSelectedJobTitleId(match.id);
          }
        }
      }
    },
    [searchedCpf, findExistingEmployee, lookupUnifiedByCpf, allowedJobTitles, allowedJobTitleIds, name, phone, gender, pixKey, pixType]
  );

  useEffect(() => {
    if (cpfValue.replace(/\D/g, "").length === 11) {
      const clean = cpfValue.replace(/\D/g, "");
      const existing = findExistingEmployee(clean);
      if (existing) {
        setLinkedEmployeeId(existing.id);
        setLinkedSourceLabel("Freelancer já cadastrado — dados preenchidos automaticamente.");
      } else {
        setLinkedEmployeeId(null);
        setLinkedSourceLabel(null);
      }
    }
  }, [targetUnitId, cpfValue, findExistingEmployee]);

  const cleanCpf = unmaskCpf(cpfValue);
  const cpfReady = cleanCpf.length === 11;
  const cpfValid = isValidCpf(cleanCpf);
  const nameWordsOk = name.trim().split(/\s+/).filter((w) => w.length >= 2).length >= 2;
  const phoneDigits = phone.replace(/\D/g, "");
  const rateNum = parseFloat(rate) || 0;

  const isFormValid =
    cpfValid &&
    nameWordsOk &&
    !!selectedJobTitleId &&
    !!chosenSectorId &&
    phoneDigits.length >= 10 &&
    rateNum > 0 &&
    !!startTime &&
    !!endTime &&
    startTime < endTime &&
    (gender === "M" || gender === "F");

  async function handleSubmit() {
    setSubmitError(null);

    if (!isFormValid) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const cpfToStore = unmaskCpf(cpfValue);
    let empId = linkedEmployeeId;

    if (!empId) {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const chosenJt = allowedJobTitles.find((jt) => jt.id === selectedJobTitleId);

        const { data, error } = await supabase
          .from("employees")
          .insert({
            unit_id: targetUnitId,
            name: name.trim(),
            gender: gender as "M" | "F",
            worker_type: "freelancer" as const,
            default_rate: rateNum,
            job_title: chosenJt?.name || "Freelancer",
            job_title_id: selectedJobTitleId,
            cpf: cpfToStore,
            phone: phone.trim() || null,
            active: true,
          })
          .select("id")
          .single();

        if (error) throw error;
        empId = data.id;

        if (pixKey || phone) {
          await supabase
            .from("freelancer_profiles" as any)
            .upsert(
              {
                cpf: cpfToStore,
                nome_completo: name.trim(),
                telefone: phone.trim() || null,
                chave_pix: pixKey.trim() || null,
                tipo_chave_pix: pixType || null,
              },
              { onConflict: "cpf" }
            );
        }
      } catch (err: any) {
        const friendly = friendlyEmployeeError(err);
        setSubmitError(friendly);
        toast.error(friendly);
        return;
      }
    }

    if (!empId) {
      const msg = "Não foi possível identificar o freelancer.";
      setSubmitError(msg);
      toast.error(msg);
      return;
    }

    try {
      const result = await upsertSchedule.mutateAsync({
        employee_id: empId,
        schedule_date: date,
        sector_id: targetSectorId,
        start_time: startTime,
        end_time: endTime,
        break_duration: 0,
        schedule_type: "working",
        agreed_rate: rateNum,
      });

      onAdded?.(empId);

      const scheduleId = result?.scheduleId;
      if (scheduleId) {
        // Passo final: enviar o link D-1 individual para este freelancer
        setSuccessInfo({
          scheduleId,
          nome: name.trim(),
          telefone: phone.trim(),
          inicio: startTime,
          fim: endTime,
        });
      } else {
        onClose();
        resetForm();
      }
    } catch (err: any) {
      const msg = "Erro ao escalar: " + err.message;
      setSubmitError(msg);
      toast.error(msg);
    }
  }

  function resetForm() {
    setCpfValue("");
    setCpfTouched(false);
    setName("");
    setGender("");
    setPhone("");
    setPixKey("");
    setPixType("");
    setSelectedJobTitleId("");
    setRate("120");
    setStartTime("08:00");
    setEndTime("16:20");
    setFilled({ name: false, phone: false, pix: false, gender: false });
    setLinkedEmployeeId(null);
    setLinkedSourceLabel(null);
    setSearchedCpf("");
    setSubmitError(null);
    setSuccessInfo(null);
  }

  function handleSendD1WhatsApp() {
    if (!successInfo) return;
    const url = buildConfirmWhatsAppLink({
      nome: successInfo.nome,
      telefone: successInfo.telefone,
      data: date,
      inicio: successInfo.inicio,
      fim: successInfo.fim,
      scheduleId: successInfo.scheduleId,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleCopyD1Link() {
    if (!successInfo) return;
    try {
      await navigator.clipboard.writeText(buildConfirmUrl(successInfo.scheduleId));
      toast.success("Link D-1 copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }


  // Helper text para CPF
  let cpfHelper: { text: string; tone: "muted" | "error" | "success" } = {
    text: "Obrigatório. Sem CPF não dá pra escalar nem pagar.",
    tone: "muted",
  };
  if (cpfReady && !cpfValid && cpfTouched) {
    cpfHelper = { text: "CPF inválido. Confira os números.", tone: "error" };
  } else if (cpfReady && cpfValid && linkedSourceLabel) {
    cpfHelper = { text: linkedSourceLabel, tone: "success" };
  } else if (cpfReady && cpfValid && !linkedSourceLabel) {
    cpfHelper = { text: "CPF válido. Preencha os demais campos pra cadastrar.", tone: "muted" };
  }

  const showFormFields = cpfReady && cpfValid;

  const buttonLabel = isSaving
    ? "Escalando…"
    : linkedEmployeeId
      ? "Escalar freelancer"
      : "Cadastrar e escalar";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>+ Freelancer extra</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Sem CPF não dá pra escalar nem registrar pagamento. Digite o CPF: se o freelancer já trabalhou aqui, os dados completam automaticamente.
            </AlertDescription>
          </Alert>

          {sectors.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Setor *
              </Label>
              <Select value={chosenSectorId} onValueChange={setChosenSectorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isShared && (
            <div className="space-y-1.5 rounded-md border-2 border-primary/30 bg-primary/5 p-3">
              <Label className="text-xs flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-primary" />
                Cadastrar em qual loja?
              </Label>
              <Select value={targetUnitId} onValueChange={setTargetUnitId}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={unitId}>{unitName || "Loja atual"}</SelectItem>
                  <SelectItem value={partnerUnitId!}>
                    {partnerUnitName || "Loja parceira"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* CPF — obrigatório */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-primary" />
              CPF do freelancer *
            </Label>
            <div className="relative">
              <Input
                value={cpfValue}
                onChange={(e) => handleCpfChange(e.target.value)}
                onBlur={() => setCpfTouched(true)}
                placeholder="000.000.000-00"
                maxLength={14}
                inputMode="numeric"
                className={`text-base ${cpfTouched && cpfReady && !cpfValid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                autoFocus
                aria-required="true"
                aria-invalid={cpfTouched && cpfReady && !cpfValid}
              />
              {isLookingUp && (
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p
              className={
                cpfHelper.tone === "error"
                  ? "text-xs text-destructive flex items-center gap-1"
                  : cpfHelper.tone === "success"
                    ? "text-xs text-primary flex items-center gap-1"
                    : "text-xs text-muted-foreground"
              }
            >
              {cpfHelper.tone === "success" && <CheckCircle2 className="h-3 w-3" />}
              {cpfHelper.tone === "error" && <AlertCircle className="h-3 w-3" />}
              {cpfHelper.text}
            </p>
          </div>

          {showFormFields && (
            <>
              <div className="space-y-1.5">
                <Label>Nome completo *</Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFilled((f) => ({ ...f, name: false })); }}
                  placeholder="Nome completo"
                  className={filled.name ? "border-primary bg-primary/5" : ""}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="freelancer-gender">Gênero *</Label>
                <Select
                  value={gender}
                  onValueChange={(v) => { setGender(v as "M" | "F"); setFilled((f) => ({ ...f, gender: false })); }}
                >
                  <SelectTrigger
                    id="freelancer-gender"
                    aria-required="true"
                    className={filled.gender ? "border-primary bg-primary/5" : ""}
                  >
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Cargo *</Label>
                {allowedJobTitles.length === 0 ? (
                  canManageJobTitles ? (
                    <Button
                      type="button"
                      variant="default"
                      className="w-full"
                      onClick={() => setQuickJobTitleOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Criar e vincular cargo
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum cargo vinculado a este setor. Peça ao gerente para configurar.
                    </p>
                  )
                ) : (
                  <div className="flex gap-2">
                    <Select value={selectedJobTitleId} onValueChange={setSelectedJobTitleId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione o cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedJobTitles.map((jt) => (
                          <SelectItem key={jt.id} value={jt.id}>
                            {jt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {canManageJobTitles && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Criar/vincular novo cargo"
                        onClick={() => setQuickJobTitleOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone *</Label>
                  <Input
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setFilled((f) => ({ ...f, phone: false })); }}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    className={`text-base ${filled.phone ? "border-primary bg-primary/5" : ""}`}
                    aria-required="true"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Chave PIX</Label>
                  <Input
                    value={pixKey}
                    onChange={(e) => { setPixKey(e.target.value); setFilled((f) => ({ ...f, pix: false })); }}
                    placeholder="Chave PIX"
                    className={filled.pix ? "border-primary bg-primary/5" : ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Início</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Valor da Diária (R$) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block w-full">
                      <Button
                        className="w-full min-h-11"
                        onClick={handleSubmit}
                        disabled={!isFormValid || isSaving}
                      >
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {buttonLabel}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isFormValid && (
                    <TooltipContent>
                      Preencha CPF e demais campos obrigatórios para escalar.
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </DialogContent>

      <QuickCreateJobTitleDialog
        open={quickJobTitleOpen}
        onClose={() => setQuickJobTitleOpen(false)}
        unitId={targetUnitId}
        sectorId={targetSectorId}
        alreadyLinkedIds={allowedJobTitleIds}
        onLinked={(jt) => {
          setSelectedJobTitleId(jt.id);
        }}
      />
    </Dialog>
  );
}
