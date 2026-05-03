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
import { Loader2, Link2, Search, CheckCircle2, UserPlus, AlertTriangle, Plus, Building2 } from "lucide-react";
import { useEmployees, friendlyEmployeeError } from "@/hooks/useEmployees";
import { useUpsertSchedule } from "@/hooks/useManualSchedules";
import { useSectorJobTitles } from "@/hooks/useSectorJobTitles";
import { useJobTitles } from "@/hooks/useJobTitles";
import { useCpfLookup } from "@/hooks/useCpfLookup";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatCPF } from "@/lib/formatters";
import { toast } from "sonner";
import { QuickCreateJobTitleDialog } from "./QuickCreateJobTitleDialog";

interface FreelancerAddModalProps {
  open: boolean;
  onClose: () => void;
  unitId: string;
  unitName?: string;
  sectorId: string;
  date: string;
  /** When sector is shared with a partner unit */
  partnerUnitId?: string;
  partnerUnitName?: string;
  partnerSectorId?: string;
  /** All sectors of the unit (allows choosing any sector). */
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
  // User-chosen sector (defaults to the one the button was clicked from)
  const [chosenSectorId, setChosenSectorId] = useState<string>(sectorId);
  // Only allow partner-unit toggle when user is operating on the originally paired sector
  const isShared = !!partnerUnitId && !!partnerSectorId && chosenSectorId === sectorId;

  // Track which side (loja) the freelancer will be linked to
  const [targetUnitId, setTargetUnitId] = useState<string>(unitId);
  const targetSectorId = isShared && targetUnitId === partnerUnitId ? partnerSectorId! : chosenSectorId;

  // Fetch employees from BOTH units (so existing-employee detection covers both sides)
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

  // Form state — CPF-first flow
  const [noCpfMode, setNoCpfMode] = useState(false);
  const [cpfValue, setCpfValue] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("");
  const [selectedJobTitleId, setSelectedJobTitleId] = useState("");
  const [rate, setRate] = useState("120");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:20");

  // Auto-fill markers (per field, for green highlight)
  const [filled, setFilled] = useState({
    name: false,
    phone: false,
    pix: false,
  });

  // When CPF matches an existing employee in target unit → silent reuse
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(null);
  const [linkedSourceLabel, setLinkedSourceLabel] = useState<string | null>(null);
  const [searchedCpf, setSearchedCpf] = useState<string>("");

  // Reset form & target when modal opens
  useEffect(() => {
    if (open) {
      setChosenSectorId(sectorId);
      setTargetUnitId(unitId);
      resetForm();
    }
  }, [open, unitId, sectorId]);

  // When user changes sector, clear cargo (job titles list will refresh)
  useEffect(() => {
    setSelectedJobTitleId("");
  }, [chosenSectorId]);

  const isSaving = upsertSchedule.isPending;

  /** Find existing employee in target unit by clean CPF */
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

      // Reset linked state if user is editing CPF
      if (clean.length < 11) {
        setLinkedEmployeeId(null);
        setLinkedSourceLabel(null);
        setSearchedCpf("");
        return;
      }

      if (clean.length === 11 && clean !== searchedCpf) {
        setSearchedCpf(clean);

        // 1. Quick check: is this freelancer already in our employees list for target unit?
        const existing = findExistingEmployee(clean);
        if (existing) {
          setLinkedEmployeeId(existing.id);
          setLinkedSourceLabel(`Vinculado a cadastro existente${existing.unit_id !== targetUnitId ? "" : " desta loja"}`);
          setName(existing.name);
          setPhone(existing.phone || "");
          if (existing.job_title_id && allowedJobTitleIds.has(existing.job_title_id)) {
            setSelectedJobTitleId(existing.job_title_id);
          }
          if (existing.default_rate) setRate(String(existing.default_rate));
          setFilled({ name: true, phone: !!existing.phone, pix: false });
          toast.success(`Freelancer "${existing.name}" já cadastrado — dados carregados.`);
          return;
        }

        // 2. Unified lookup across freelancer_profiles, employees (other units), freelancer_entries
        const result = await lookupUnifiedByCpf(formatted);
        if (result) {
          setName(result.nome_completo || "");
          setPhone(result.telefone || "");
          setPixKey(result.chave_pix || "");
          setPixType(result.tipo_chave_pix || "");
          setFilled({
            name: !!result.nome_completo,
            phone: !!result.telefone,
            pix: !!result.chave_pix,
          });

          // Try to match the historical "funcao" to an allowed job title
          if (result.funcao) {
            const match = allowedJobTitles.find(
              (jt) => jt.name.toLowerCase() === result.funcao!.toLowerCase()
            );
            if (match) setSelectedJobTitleId(match.id);
          }
        }
      }
    },
    [searchedCpf, findExistingEmployee, lookupUnifiedByCpf, allowedJobTitles, allowedJobTitleIds, targetUnitId]
  );

  // When the user changes target unit (shared sector), re-evaluate linked state
  useEffect(() => {
    if (cpfValue.replace(/\D/g, "").length === 11) {
      const clean = cpfValue.replace(/\D/g, "");
      const existing = findExistingEmployee(clean);
      if (existing) {
        setLinkedEmployeeId(existing.id);
        setLinkedSourceLabel("Vinculado a cadastro existente");
      } else {
        setLinkedEmployeeId(null);
        setLinkedSourceLabel(null);
      }
    }
  }, [targetUnitId, cpfValue, findExistingEmployee]);

  async function handleSubmit() {
    const rateNum = parseFloat(rate) || 0;
    const cleanCpf = cpfValue.replace(/\D/g, "");

    if (!noCpfMode) {
      if (!cleanCpf || cleanCpf.length !== 11) {
        toast.error("Informe um CPF válido (11 dígitos).");
        return;
      }
    }
    if (!name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    if (!selectedJobTitleId) {
      toast.error("Selecione um cargo.");
      return;
    }

    let empId = linkedEmployeeId;

    if (!empId) {
      // Create the employee
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const chosenJt = allowedJobTitles.find((jt) => jt.id === selectedJobTitleId);

        // In no-CPF mode, leave cpf NULL so we don't pollute lookup tables
        const cpfToStore = noCpfMode ? null : cleanCpf;

        // Defensive lookup: when in no-CPF mode (or CPF didn't match), check if there's
        // already an active employee with the same name in this unit to avoid creating
        // homonyms that violate unique_active_employee_no_cpf.
        if (noCpfMode) {
          const { data: existingByName } = await supabase
            .from("employees")
            .select("id, name, default_rate, job_title_id")
            .eq("unit_id", targetUnitId)
            .eq("active", true)
            .ilike("name", name.trim())
            .order("created_at", { ascending: true })
            .limit(1);

          if (existingByName && existingByName.length > 0) {
            empId = existingByName[0].id;
            toast.info(
              `Reutilizando cadastro existente de "${existingByName[0].name}" nesta loja.`
            );
          }
        }

        if (!empId) {
          const { data, error } = await supabase
            .from("employees")
            .insert({
              unit_id: targetUnitId,
              name: name.trim(),
              gender: "M",
              worker_type: "freelancer" as const,
              default_rate: rateNum,
              job_title: chosenJt?.name || "Freelancer",
              job_title_id: selectedJobTitleId,
              cpf: cpfToStore,
              phone: phone.trim() || null,
            })
            .select("id")
            .single();

          if (error) {
            // Race condition with unique_active_employee_no_cpf → re-fetch
            if ((error as any).code === "23505") {
              const { data: race } = await supabase
                .from("employees")
                .select("id")
                .eq("unit_id", targetUnitId)
                .eq("active", true)
                .ilike("name", name.trim())
                .order("created_at", { ascending: true })
                .limit(1);
              if (race && race.length > 0) {
                empId = race[0].id;
                toast.info("Reutilizando cadastro existente desta loja.");
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          } else {
            empId = data.id;
          }
        }

        // Only persist to freelancer_profiles when we have a real CPF
        if (!noCpfMode && (pixKey || phone)) {
          await supabase
            .from("freelancer_profiles" as any)
            .upsert(
              {
                cpf: cleanCpf,
                nome_completo: name.trim(),
                telefone: phone.trim() || null,
                chave_pix: pixKey.trim() || null,
                tipo_chave_pix: pixType || null,
              },
              { onConflict: "cpf" }
            );
        }
      } catch (err: any) {
        toast.error(friendlyEmployeeError(err));
        return;
      }
    }

    if (!empId) {
      toast.error("Não foi possível identificar o freelancer.");
      return;
    }

    try {
      await upsertSchedule.mutateAsync({
        employee_id: empId,
        schedule_date: date,
        sector_id: targetSectorId,
        start_time: startTime,
        end_time: endTime,
        break_duration: 0,
        schedule_type: "working",
        agreed_rate: rateNum,
      });

      if (noCpfMode) {
        toast.warning("Freelancer escalado sem CPF. Lembre de completar o cadastro depois para liberar pagamento.", {
          duration: 5000,
        });
      }

      onAdded?.(empId);
      onClose();
      resetForm();
    } catch (err: any) {
      toast.error("Erro ao escalar: " + err.message);
    }
  }

  function resetForm() {
    setNoCpfMode(false);
    setCpfValue("");
    setName("");
    setPhone("");
    setPixKey("");
    setPixType("");
    setSelectedJobTitleId("");
    setRate("120");
    setStartTime("08:00");
    setEndTime("16:20");
    setFilled({ name: false, phone: false, pix: false });
    setLinkedEmployeeId(null);
    setLinkedSourceLabel(null);
    setSearchedCpf("");
  }

  const cpfReady = cpfValue.replace(/\D/g, "").length === 11;
  const showFormFields = cpfReady || noCpfMode;

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
          {/* Sector selector — choose any sector of the unit */}
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

          {/* Shared sector → unit toggle */}
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

          {/* CPF — primary entry (skipped in no-CPF mode) */}
          {!noCpfMode && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-primary" />
                CPF do freelancer *
              </Label>
              <div className="relative">
                <Input
                  value={cpfValue}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  inputMode="numeric"
                  className="text-base"
                  autoFocus
                />
                {isLookingUp && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {linkedSourceLabel && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {linkedSourceLabel}
                </p>
              )}
              {!cpfReady && (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    Ao informar o CPF, o sistema busca automaticamente os dados nos cadastros existentes.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setNoCpfMode(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Lançar sem CPF (cadastro provisório)
                  </Button>
                </>
              )}
            </div>
          )}

          {noCpfMode && (
            <div className="rounded-md border-2 border-destructive/40 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 text-xs text-foreground">
                  <p className="font-semibold">Modo sem CPF ativado</p>
                  <p className="text-muted-foreground mt-0.5">
                    O freelancer entrará na escala como cadastro provisório. Sem CPF, o pagamento via Budget Gerencial fica pendente até completar os dados.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => { setNoCpfMode(false); }}
              >
                ← Voltar e informar CPF
              </Button>
            </div>
          )}

          {showFormFields && (
            <>
              <div className="space-y-1.5">
                <Label>Nome completo *</Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFilled((f) => ({ ...f, name: false })); }}
                  placeholder="Nome completo"
                  className={filled.name ? "border-primary bg-primary/5" : ""}
                  autoFocus={noCpfMode}
                />
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


              {!noCpfMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone <span className="text-muted-foreground">(opcional — confirmado no check-in)</span></Label>
                    <Input
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setFilled((f) => ({ ...f, phone: false })); }}
                      placeholder="(00) 00000-0000"
                      className={filled.phone ? "border-primary bg-primary/5" : ""}
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
              )}

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
                <Label>Valor da Diária (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {linkedEmployeeId
                  ? "Adicionar à Escala"
                  : noCpfMode
                    ? "Escalar sem CPF (provisório)"
                    : "Cadastrar e Adicionar à Escala"}
              </Button>
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
          // Pré-seleciona automaticamente o cargo recém-criado
          setSelectedJobTitleId(jt.id);
        }}
      />
    </Dialog>
  );
}
