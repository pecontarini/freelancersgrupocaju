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
import { Loader2, UserPlus } from "lucide-react";
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

  const [activeUnit, setActiveUnit] = useState<string | null>(unitId);
  const [activeSector, setActiveSector] = useState<string | null>(sectorId);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [customJobTitle, setCustomJobTitle] = useState("");

  // Reset whenever opened
  useEffect(() => {
    if (open) {
      setActiveUnit(unitId);
      setActiveSector(sectorId);
      setName("");
      setGender("M");
      setPhone("");
      setJobTitle("");
      setCustomJobTitle("");
    }
  }, [open, unitId, sectorId]);

  const { data: sectors = [] } = useSectors(activeUnit);
  const { data: jobTitlesDb = [] } = useJobTitles(activeUnit);
  const { data: sectorJobTitles = [] } = useSectorJobTitles(activeSector ? [activeSector] : []);
  const { data: employees = [] } = useEmployees(activeUnit);

  const addEmployee = useAddEmployee();
  const upsertJobTitle = useUpsertJobTitle();
  const linkSectorJobTitle = useAddSectorJobTitle();

  const allJobTitleNames = Array.from(new Set([
    ...jobTitlesDb.map((j) => j.name),
    ...DEFAULT_JOB_TITLES,
  ])).sort();

  const isSaving = addEmployee.isPending || upsertJobTitle.isPending || linkSectorJobTitle.isPending;

  async function handleSubmit() {
    if (!activeUnit) {
      toast.error("Selecione uma unidade.");
      return;
    }
    if (!activeSector) {
      toast.error("Selecione um setor.");
      return;
    }
    if (!name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    const resolvedTitle =
      jobTitle === "__custom__" ? customJobTitle.trim() : jobTitle.trim();
    if (!resolvedTitle) {
      toast.error("Selecione ou informe um cargo.");
      return;
    }

    // Defensive duplicate pre-check
    const normalizedName = name.trim().toLowerCase();
    const normalizedTitle = resolvedTitle.toLowerCase();
    const duplicate = employees.find((e) => {
      const hasNoCpf = !e.cpf || e.cpf === "";
      return (
        hasNoCpf &&
        e.name.trim().toLowerCase() === normalizedName &&
        (e.job_title || "").trim().toLowerCase() === normalizedTitle
      );
    });
    if (duplicate) {
      toast.error(
        `Já existe um funcionário "${duplicate.name}" com o cargo "${duplicate.job_title || "—"}" nesta unidade. Adicione um sobrenome para diferenciar.`,
        { duration: 6000 }
      );
      return;
    }

    try {
      // 1. Upsert cargo
      const jt = await upsertJobTitle.mutateAsync({
        name: resolvedTitle,
        unit_id: activeUnit,
      });

      // 2. Vincular cargo ao setor (idempotente)
      const alreadyLinked = sectorJobTitles.some(
        (sjt) => sjt.sector_id === activeSector && sjt.job_title_id === jt.id
      );
      if (!alreadyLinked) {
        await linkSectorJobTitle.mutateAsync({
          sectorId: activeSector,
          jobTitleId: jt.id,
        });
      }

      // 3. Criar funcionário
      const cleanPhone = phone.replace(/\D/g, "") || undefined;
      await addEmployee.mutateAsync({
        unit_id: activeUnit,
        name: name.trim(),
        gender,
        phone: cleanPhone,
        job_title: resolvedTitle,
        job_title_id: jt.id,
      });

      toast.success("Funcionário criado e vinculado ao setor!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(friendlyEmployeeError(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Novo funcionário
          </DialogTitle>
          <DialogDescription>
            Cadastre e vincule automaticamente ao setor e cargo selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
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

          <div className="space-y-1.5">
            <Label className="text-xs">Setor *</Label>
            <Select
              value={activeSector || ""}
              onValueChange={setActiveSector}
              disabled={!activeUnit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
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
                <SelectValue placeholder="Selecione o cargo" />
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
            {jobTitle === "__custom__" && (
              <Input
                placeholder="Digite o novo cargo"
                value={customJobTitle}
                onChange={(e) => setCustomJobTitle(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
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
              <Label className="text-xs">Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar e vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
