import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Loader2, UserPlus, Info, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  useAddEmployee,
  useEmployees,
  friendlyEmployeeError,
} from "@/hooks/useEmployees";
import { useJobTitles, useUpsertJobTitle } from "@/hooks/useJobTitles";
import {
  useSectorJobTitles,
  useAddSectorJobTitle,
} from "@/hooks/useSectorJobTitles";
import { useSectors } from "@/hooks/useStaffingMatrix";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAccessibleStores } from "@/hooks/useAccessibleStores";
import { useCpfLookup } from "@/hooks/useCpfLookup";
import { isValidCpf, formatCpf, unmaskCpf } from "@/lib/cpf";
import { WorkerTypeSegmented, type WorkerType } from "./WorkerTypeSegmented";
import { UrgentCltConfirmDialog } from "./UrgentCltConfirmDialog";

const DEFAULT_JOB_TITLES = [
  "Garçom", "Cozinheiro", "Auxiliar de Cozinha", "Parrillero",
  "Bartender", "Hostess", "Caixa", "ASG", "Sushiman",
  "Chefe de Salão", "Chefe de Cozinha", "Chefe de Bar", "Gerente",
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isFullName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 && parts.every((p) => p.length >= 2);
}

function parseRate(value: string): number {
  const cleaned = value.replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function formatRate(value: number): string {
  if (!value) return "";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string | null;
  sectorId: string | null;
}

export function QuickCreateEmployeeModal({ open, onOpenChange, unitId, sectorId }: Props) {
  const { isAdmin, isOperator, isGerenteUnidade } = useUserProfile();
  const { stores: accessibleStores } = useAccessibleStores();
  const canChooseUnit = isAdmin || isOperator || isGerenteUnidade;

  const [workerType, setWorkerType] = useState<WorkerType>("freelancer");
  const [activeUnit, setActiveUnit] = useState<string | null>(unitId);
  const [activeSector, setActiveSector] = useState<string | null>(sectorId);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [rate, setRate] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [customJobTitle, setCustomJobTitle] = useState("");
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setWorkerType("freelancer");
      setActiveUnit(unitId);
      setActiveSector(sectorId);
      setName("");
      setGender("M");
      setPhone("");
      setCpf("");
      setRate("");
      setJobTitle("");
      setCustomJobTitle("");
      setSubmitError(null);
    }
  }, [open, unitId, sectorId]);

  const { data: sectors = [] } = useSectors(activeUnit);
  const { data: jobTitlesDb = [] } = useJobTitles(activeUnit);
  const { data: sectorJobTitles = [] } = useSectorJobTitles(activeSector ? [activeSector] : []);
  const { data: employees = [] } = useEmployees(activeUnit);

  const addEmployee = useAddEmployee();
  const upsertJobTitle = useUpsertJobTitle();
  const linkSectorJobTitle = useAddSectorJobTitle();
  const { lookupUnifiedByCpf, isLookingUp } = useCpfLookup();

  const allJobTitleNames = Array.from(new Set([
    ...jobTitlesDb.map((j) => j.name),
    ...DEFAULT_JOB_TITLES,
  ])).sort();

  const isSaving =
    addEmployee.isPending || upsertJobTitle.isPending || linkSectorJobTitle.isPending;

  const isFreelancer = workerType === "freelancer";

  // Auto-fill por CPF (só freelancer)
  async function handleCpfBlur() {
    if (!isFreelancer) return;
    const clean = unmaskCpf(cpf);
    if (clean.length !== 11 || !isValidCpf(clean)) return;
    const found = await lookupUnifiedByCpf(clean);
    if (!found) return;
    if (!name) setName(found.nome_completo || "");
    if (!phone && found.telefone) setPhone(formatPhone(found.telefone));
  }

  function validate(): string | null {
    if (!activeUnit) return "Selecione a unidade.";
    if (!activeSector) return "Selecione o setor.";
    const resolvedTitle =
      jobTitle === "__custom__" ? customJobTitle.trim() : jobTitle.trim();
    if (!resolvedTitle) return "Selecione ou informe um cargo.";
    if (!isFullName(name)) return "Nome completo obrigatório (nome e sobrenome).";

    if (isFreelancer) {
      if (!isValidCpf(cpf)) return "CPF inválido.";
      if (!phone.replace(/\D/g, "")) return "Telefone obrigatório.";
      if (parseRate(rate) <= 0) return "Valor da diária obrigatório.";
    } else {
      // CLT urgência: CPF obrigatório
      if (!isValidCpf(cpf)) return "CPF inválido.";
    }
    return null;
  }

  async function persist(workerTypeOverride?: WorkerType, aguardando?: boolean) {
    const wt = workerTypeOverride ?? workerType;
    const err = validate();
    if (err) {
      setSubmitError(err);
      toast.error(err);
      return;
    }
    setSubmitError(null);

    const resolvedTitle =
      jobTitle === "__custom__" ? customJobTitle.trim() : jobTitle.trim();

    // pre-check duplicate: normaliza nome (remove sufixos entre parênteses, acentos, case)
    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s*\([^)]*\)\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const normalizedName = normalize(name);
    if (!cpf) {
      const dup = employees.find((e) => normalize(e.name) === normalizedName);
      if (dup) {
        const isSecullum = !!(dup as any).secullum_id;
        const m = isSecullum
          ? `Já existe um cadastro Secullum "${dup.name}" nesta unidade. Reaproveite o cadastro existente em vez de criar novo.`
          : `Já existe um funcionário "${dup.name}" nesta unidade. Informe o CPF para diferenciar ou edite o cadastro existente.`;
        setSubmitError(m);
        toast.error(m, { duration: 8000 });
        return;
      }
    }


    try {
      const jt = await upsertJobTitle.mutateAsync({
        name: resolvedTitle,
        unit_id: activeUnit!,
      });
      const alreadyLinked = sectorJobTitles.some(
        (sjt) => sjt.sector_id === activeSector && sjt.job_title_id === jt.id
      );
      if (!alreadyLinked) {
        await linkSectorJobTitle.mutateAsync({
          sectorId: activeSector!,
          jobTitleId: jt.id,
        });
      }

      await addEmployee.mutateAsync({
        unit_id: activeUnit!,
        name: name.trim(),
        gender,
        phone: phone.replace(/\D/g, "") || undefined,
        cpf: unmaskCpf(cpf) || undefined,
        job_title: resolvedTitle,
        job_title_id: jt.id,
        worker_type: wt,
        default_rate: isFreelancer ? parseRate(rate) : undefined,
        aguardando_secullum: aguardando,
      });

      if (wt === "clt" && aguardando) {
        toast.success(
          "Solicitação enviada. O DP precisa regularizar no Secullum em até 7 dias."
        );
      } else {
        toast.success("Freelancer criado!");
      }
      onOpenChange(false);
    } catch (err: any) {
      const m = friendlyEmployeeError(err);
      setSubmitError(m);
      toast.error(m);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Novo cadastro
            </DialogTitle>
            <DialogDescription>
              Por padrão criamos freelancers. Cadastros CLT vêm do Secullum automaticamente
              todo dia às 5h.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <WorkerTypeSegmented
              value={workerType}
              onChange={(v) => {
                setWorkerType(v);
                setSubmitError(null);
              }}
              disabled={isSaving}
            />

            {!isFreelancer && (
              <Alert className="border-amber-500/40 bg-amber-500/10">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                  Cadastro CLT deve ser feito pelo Secullum primeiro. Use esta opção
                  apenas em casos de urgência aprovada.
                </AlertDescription>
              </Alert>
            )}

            {canChooseUnit && (
              <div className="space-y-1.5">
                <Label className="text-xs">Unidade *</Label>
                <Select
                  value={activeUnit || ""}
                  onValueChange={(v) => {
                    setActiveUnit(v);
                    setActiveSector(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessibleStores.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Setor *</Label>
                <Select
                  value={activeSector || ""}
                  onValueChange={setActiveSector}
                  disabled={!activeUnit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cargo *</Label>
                <Select value={jobTitle} onValueChange={setJobTitle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {allJobTitleNames.map((j) => (
                      <SelectItem key={j} value={j}>
                        {j}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">+ Novo cargo…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {jobTitle === "__custom__" && (
              <Input
                placeholder="Digite o novo cargo"
                value={customJobTitle}
                onChange={(e) => setCustomJobTitle(e.target.value)}
              />
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">CPF *</Label>
              <Input
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                onBlur={handleCpfBlur}
                placeholder="000.000.000-00"
                inputMode="numeric"
                disabled={isLookingUp}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nome completo *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome e sobrenome"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Gênero</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as "M" | "F")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Telefone {isFreelancer && "*"}
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  inputMode="numeric"
                />
              </div>
            </div>

            {isFreelancer && (
              <div className="space-y-1.5">
                <Label className="text-xs">Valor da diária (R$) *</Label>
                <Input
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  onBlur={() => {
                    const n = parseRate(rate);
                    setRate(n > 0 ? formatRate(n) : "");
                  }}
                  placeholder="R$ 120,00"
                  inputMode="decimal"
                />
              </div>
            )}

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{submitError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            {isFreelancer ? (
              <Button onClick={() => persist("freelancer")} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar freelancer
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  const err = validate();
                  if (err) {
                    setSubmitError(err);
                    toast.error(err);
                    return;
                  }
                  setUrgentOpen(true);
                }}
                disabled={isSaving}
                className="gap-2"
              >
                <ShieldAlert className="h-4 w-4" />
                Solicitar cadastro urgente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UrgentCltConfirmDialog
        open={urgentOpen}
        onOpenChange={setUrgentOpen}
        loading={isSaving}
        onConfirm={async () => {
          setUrgentOpen(false);
          await persist("clt", true);
        }}
      />
    </>
  );
}
