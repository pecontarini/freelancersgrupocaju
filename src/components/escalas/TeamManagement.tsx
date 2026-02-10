import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UserPlus,
  Pencil,
  Trash2,
  Phone,
  Loader2,
  Users,
} from "lucide-react";
import { BulkImportTab } from "./BulkImportTab";
import {
  useEmployees,
  useAddEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  type Employee,
} from "@/hooks/useEmployees";
import { useJobTitles, useUpsertJobTitle } from "@/hooks/useJobTitles";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

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

export function TeamManagement() {
  const { effectiveUnidadeId: unidadeId } = useUnidade();
  const { data: employees = [], isLoading } = useEmployees(unidadeId);
  const { data: dbJobTitles = [] } = useJobTitles(unidadeId);
  const addEmployee = useAddEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const upsertJobTitle = useUpsertJobTitle();

  // Merge DB titles with defaults (deduplicated)
  const allJobTitleNames = Array.from(new Set([
    ...dbJobTitles.map((jt) => jt.name),
    ...DEFAULT_JOB_TITLES,
  ])).sort();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [customJobTitle, setCustomJobTitle] = useState("");

  function resetForm() {
    setName("");
    setGender("M");
    setPhone("");
    setJobTitle("");
    setCustomJobTitle("");
    setEditingEmployee(null);
  }

  function openEdit(emp: Employee) {
    setEditingEmployee(emp);
    setName(emp.name);
    setGender(emp.gender);
    setPhone(emp.phone || "");
    const predefined = allJobTitleNames.find((j) => j === emp.job_title);
    if (predefined) {
      setJobTitle(predefined);
      setCustomJobTitle("");
    } else {
      setJobTitle("__custom__");
      setCustomJobTitle(emp.job_title || "");
    }
    setDialogOpen(true);
  }

  function openNew() {
    resetForm();
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!unidadeId || !name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }

    const resolvedTitle =
      jobTitle === "__custom__" ? customJobTitle : jobTitle || undefined;
    const cleanPhone = phone.replace(/\D/g, "") || undefined;

    // Upsert job title to get ID
    let resolvedJobTitleId: string | undefined;
    if (resolvedTitle) {
      try {
        const jt = await upsertJobTitle.mutateAsync({ name: resolvedTitle, unit_id: unidadeId });
        resolvedJobTitleId = jt.id;
      } catch {
        // Continue without job_title_id if upsert fails
      }
    }

    if (editingEmployee) {
      await updateEmployee.mutateAsync({
        id: editingEmployee.id,
        name: name.trim(),
        gender,
        phone: cleanPhone,
        job_title: resolvedTitle,
        job_title_id: resolvedJobTitleId,
      });
    } else {
      await addEmployee.mutateAsync({
        unit_id: unidadeId,
        name: name.trim(),
        gender,
        phone: cleanPhone,
        job_title: resolvedTitle,
        job_title_id: resolvedJobTitleId,
      });
    }

    setDialogOpen(false);
    resetForm();
  }

  const isSaving = addEmployee.isPending || updateEmployee.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">
            Equipe ({employees.length})
          </h3>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNew}>
              <UserPlus className="h-4 w-4" />
              Adicionar Equipe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? "Editar Funcionário" : "Adicionar Funcionário"}
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="manual">
              <TabsList className="w-full">
                <TabsTrigger value="manual" className="flex-1">
                  Cadastro Manual
                </TabsTrigger>
                <TabsTrigger value="import" className="flex-1">
                  Importação em Massa
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-4 pt-2">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="emp-name">Nome Completo *</Label>
                  <Input
                    id="emp-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João da Silva"
                  />
                </div>

                {/* Job Title */}
                <div className="space-y-1.5">
                  <Label>Cargo / Função *</Label>
                  <Select value={jobTitle} onValueChange={setJobTitle}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {allJobTitleNames.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">✏️ Outro...</SelectItem>
                    </SelectContent>
                  </Select>
                  {jobTitle === "__custom__" && (
                    <Input
                      className="mt-1.5"
                      value={customJobTitle}
                      onChange={(e) => setCustomJobTitle(e.target.value)}
                      placeholder="Digite o cargo"
                    />
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="emp-phone">
                    <Phone className="h-3.5 w-3.5 inline mr-1" />
                    Telefone / WhatsApp
                  </Label>
                  <Input
                    id="emp-phone"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    inputMode="tel"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <Label>Gênero</Label>
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

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={isSaving || !name.trim()}
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingEmployee ? "Salvar Alterações" : "Cadastrar"}
                </Button>
              </TabsContent>

              <TabsContent value="import">
                <BulkImportTab
                  unitId={unidadeId}
                  onDone={() => setDialogOpen(false)}
                />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Employee List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>Nenhum funcionário cadastrado nesta unidade.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                <TableHead className="hidden sm:table-cell">Gênero</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>
                    {emp.job_title ? (
                      <Badge variant="secondary">{emp.job_title}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {emp.phone ? formatPhone(emp.phone) : "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {emp.gender === "F" ? "Feminino" : "Masculino"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(emp)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteEmployee.mutate(emp.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
