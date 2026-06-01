import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  UserPlus,
  XCircle,
  Search,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ScheduleEmployee, UnmatchedEmployee } from "@/lib/scheduleExcel";
import { normalizeCpf } from "@/lib/scheduleExcel";
import { cn } from "@/lib/utils";

export type ReviewAction = "link" | "create" | "ignore";

export interface ReviewDecision {
  rowIndex: number;
  action: ReviewAction;
  /** When action=link: the existing employee id chosen by the manager. */
  linkEmployeeId?: string;
  linkEmployeeName?: string;
  /** When action=create: form data confirmed by the manager. */
  newName?: string;
  newCargo?: string;
  newCpf?: string; // normalized 11 digits or empty
  newGender?: "M" | "F" | "O";
  newWorkerType?: "clt" | "freelancer";
  /** When action=create and CPF matches an INACTIVE existing employee, this id is reactivated instead of insert. */
  reactivateEmployeeId?: string;
}

interface CpfCheckState {
  loading: boolean;
  found: { id: string; name: string; active: boolean } | null;
}

interface UnmatchedReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unmatched: UnmatchedEmployee[];
  allUnitEmployees: ScheduleEmployee[];
  unitId: string;
  onConfirm: (decisions: ReviewDecision[]) => void;
  onCancel: () => void;
}

function isDecisionValid(d: ReviewDecision, cpfCheck?: CpfCheckState): boolean {
  if (d.action === "ignore") return true;
  if (d.action === "link") return !!d.linkEmployeeId;
  if (d.action === "create") {
    if (!d.newName?.trim()) return false;
    if (!d.newGender) return false;
    if (!d.newWorkerType) return false;
    // If a CPF was typed and it matches an ACTIVE employee → block (must link instead)
    if (d.newCpf && d.newCpf.length === 11 && cpfCheck?.found?.active) return false;
    return true;
  }
  return false;
}

export function UnmatchedReviewDialog({
  open,
  onOpenChange,
  unmatched,
  allUnitEmployees,
  unitId,
  onConfirm,
  onCancel,
}: UnmatchedReviewDialogProps) {
  // Default each row: link if has good candidate (≥0.8), else create
  const [decisions, setDecisions] = useState<Map<number, ReviewDecision>>(new Map());
  const [cpfChecks, setCpfChecks] = useState<Map<number, CpfCheckState>>(new Map());
  const [linkSearchOpen, setLinkSearchOpen] = useState<Map<number, boolean>>(new Map());

  // Initialize defaults when unmatched changes / dialog opens
  useEffect(() => {
    if (!open) return;
    const next = new Map<number, ReviewDecision>();
    for (const u of unmatched) {
      const top = u.candidates?.[0];
      const hasGoodCandidate = top && top.similarity >= 0.8;
      next.set(u.rowIndex, {
        rowIndex: u.rowIndex,
        action: hasGoodCandidate ? "link" : "create",
        linkEmployeeId: hasGoodCandidate ? top!.id : undefined,
        linkEmployeeName: hasGoodCandidate ? top!.name : undefined,
        newName: u.name,
        newCargo: u.cargo,
        newCpf: u.cpf || "",
        newGender: undefined,
        newWorkerType: undefined,
      });
    }
    setDecisions(next);
    setCpfChecks(new Map());
  }, [open, unmatched]);

  const updateDecision = (rowIndex: number, patch: Partial<ReviewDecision>) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      const current = next.get(rowIndex);
      if (!current) return prev;
      next.set(rowIndex, { ...current, ...patch });
      return next;
    });
  };

  // Debounced CPF lookup for "create" rows with a typed CPF
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    decisions.forEach((d, rowIndex) => {
      if (d.action !== "create") return;
      const cpf = normalizeCpf(d.newCpf);
      if (!cpf) {
        setCpfChecks((prev) => {
          if (!prev.has(rowIndex)) return prev;
          const next = new Map(prev);
          next.delete(rowIndex);
          return next;
        });
        return;
      }
      const t = setTimeout(async () => {
        setCpfChecks((prev) => {
          const next = new Map(prev);
          next.set(rowIndex, { loading: true, found: null });
          return next;
        });
        const { data } = await supabase
          .from("employees")
          .select("id, name, active")
          .eq("unit_id", unitId)
          .eq("cpf", cpf)
          .order("active", { ascending: false })
          .limit(1);
        const found = data && data.length > 0 ? data[0] as { id: string; name: string; active: boolean } : null;
        setCpfChecks((prev) => {
          const next = new Map(prev);
          next.set(rowIndex, { loading: false, found });
          return next;
        });
        // If found INACTIVE → preset reactivateEmployeeId
        if (found && !found.active) {
          updateDecision(rowIndex, { reactivateEmployeeId: found.id });
        } else {
          updateDecision(rowIndex, { reactivateEmployeeId: undefined });
        }
      }, 400);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Array.from(decisions.values()).map((d) => ({ r: d.rowIndex, a: d.action, c: d.newCpf })))]);

  const allValid = useMemo(
    () => unmatched.every((u) => {
      const d = decisions.get(u.rowIndex);
      if (!d) return false;
      return isDecisionValid(d, cpfChecks.get(u.rowIndex));
    }),
    [unmatched, decisions, cpfChecks]
  );

  const counts = useMemo(() => {
    let link = 0, create = 0, ignore = 0;
    decisions.forEach((d) => {
      if (d.action === "link") link++;
      else if (d.action === "create") create++;
      else ignore++;
    });
    return { link, create, ignore };
  }, [decisions]);

  const handleConfirm = () => {
    if (!allValid) return;
    onConfirm(Array.from(decisions.values()));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Revisar funcionários não identificados ({unmatched.length})
          </DialogTitle>
          <DialogDescription>
            Para cada linha da planilha, escolha o que fazer. Nenhum cadastro novo é criado sem sua confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 text-xs text-muted-foreground border-y py-2">
          <span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Vincular: {counts.link}</span>
          <span className="flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Criar: {counts.create}</span>
          <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" /> Ignorar: {counts.ignore}</span>
        </div>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-3">
            {unmatched.map((u) => {
              const d = decisions.get(u.rowIndex);
              if (!d) return null;
              const cpfCheck = cpfChecks.get(u.rowIndex);
              const isAmbiguous = u.reason === "ambiguous";
              const linkOpen = linkSearchOpen.get(u.rowIndex) || false;

              return (
                <div
                  key={u.rowIndex}
                  className={cn(
                    "rounded-lg border p-3 space-y-2",
                    isAmbiguous && "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{u.name}</span>
                        {u.cargo && <Badge variant="secondary" className="text-[10px]">{u.cargo}</Badge>}
                        {u.cpf && <Badge variant="outline" className="text-[10px]">CPF {u.cpf}</Badge>}
                        {u.sectorHint && <Badge variant="outline" className="text-[10px]">{u.sectorHint}</Badge>}
                        {isAmbiguous && (
                          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Ambíguo
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Linha {u.rowIndex + 1} da planilha</div>
                    </div>
                    <Select
                      value={d.action}
                      onValueChange={(v) => updateDecision(u.rowIndex, { action: v as ReviewAction })}
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="link">Vincular a existente</SelectItem>
                        <SelectItem value="create">Criar novo cadastro</SelectItem>
                        <SelectItem value="ignore">Ignorar esta linha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* LINK ACTION */}
                  {d.action === "link" && (
                    <div className="space-y-2">
                      <Popover
                        open={linkOpen}
                        onOpenChange={(o) =>
                          setLinkSearchOpen((prev) => {
                            const next = new Map(prev);
                            next.set(u.rowIndex, o);
                            return next;
                          })
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8">
                            <span className="flex items-center gap-2 truncate">
                              <Search className="h-3.5 w-3.5 shrink-0" />
                              {d.linkEmployeeName || "Buscar funcionário..."}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command
                            filter={(value, search) => {
                              const v = value.toLowerCase();
                              const s = search.toLowerCase();
                              return v.includes(s) ? 1 : 0;
                            }}
                          >
                            <CommandInput placeholder="Buscar por nome ou CPF..." className="h-9" />
                            <CommandList>
                              <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                              <CommandGroup>
                                {allUnitEmployees.map((emp) => (
                                  <CommandItem
                                    key={emp.id}
                                    value={`${emp.name} ${emp.cpf || ""}`}
                                    onSelect={() => {
                                      updateDecision(u.rowIndex, {
                                        linkEmployeeId: emp.id,
                                        linkEmployeeName: emp.name,
                                      });
                                      setLinkSearchOpen((prev) => {
                                        const next = new Map(prev);
                                        next.set(u.rowIndex, false);
                                        return next;
                                      });
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm">{emp.name}</span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {emp.job_title || "—"} {emp.cpf ? `· CPF ${emp.cpf}` : ""}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      {u.candidates && u.candidates.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase text-muted-foreground">Sugestões</div>
                          {u.candidates.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                updateDecision(u.rowIndex, {
                                  linkEmployeeId: c.id,
                                  linkEmployeeName: c.name,
                                })
                              }
                              className={cn(
                                "w-full text-left text-xs px-2 py-1.5 rounded border flex items-center justify-between hover:bg-muted/50",
                                d.linkEmployeeId === c.id && "bg-primary/5 border-primary/40"
                              )}
                            >
                              <span className="truncate">{c.name}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                                {(c.similarity * 100).toFixed(0)}%
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CREATE ACTION */}
                  {d.action === "create" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground">Nome</label>
                          <Input
                            value={d.newName || ""}
                            onChange={(e) => updateDecision(u.rowIndex, { newName: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground">Cargo</label>
                          <Input
                            value={d.newCargo || ""}
                            onChange={(e) => updateDecision(u.rowIndex, { newCargo: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground">CPF (opcional)</label>
                          <Input
                            value={d.newCpf || ""}
                            onChange={(e) => updateDecision(u.rowIndex, { newCpf: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                            placeholder="11 dígitos"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] uppercase text-muted-foreground">Gênero *</label>
                            <Select
                              value={d.newGender || ""}
                              onValueChange={(v) => updateDecision(u.rowIndex, { newGender: v as "M" | "F" | "O" })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="M">Masculino</SelectItem>
                                <SelectItem value="F">Feminino</SelectItem>
                                <SelectItem value="O">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-muted-foreground">Tipo *</label>
                            <Select
                              value={d.newWorkerType || ""}
                              onValueChange={(v) => updateDecision(u.rowIndex, { newWorkerType: v as "clt" | "freelancer" })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="clt">CLT</SelectItem>
                                <SelectItem value="freelancer">Freelancer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* CPF duplicate warning */}
                      {cpfCheck?.loading && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Info className="h-3 w-3" /> Verificando CPF...
                        </div>
                      )}
                      {cpfCheck?.found && cpfCheck.found.active && (
                        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs flex items-start gap-2">
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium">Já existe cadastro ativo com este CPF:</div>
                            <div className="text-muted-foreground">{cpfCheck.found.name}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px]"
                            onClick={() =>
                              updateDecision(u.rowIndex, {
                                action: "link",
                                linkEmployeeId: cpfCheck.found!.id,
                                linkEmployeeName: cpfCheck.found!.name,
                              })
                            }
                          >
                            Vincular a este
                          </Button>
                        </div>
                      )}
                      {cpfCheck?.found && !cpfCheck.found.active && (
                        <div className="rounded-md border border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/10 p-2 text-xs flex items-start gap-2">
                          <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium">Existe cadastro inativo com este CPF:</div>
                            <div className="text-muted-foreground">
                              {cpfCheck.found.name} — ao confirmar, será reativado.
                            </div>
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-amber-600" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* IGNORE */}
                  {d.action === "ignore" && (
                    <div className="text-[11px] text-muted-foreground italic">
                      Esta linha não será importada nem cadastrada.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar importação
          </Button>
          <Button onClick={handleConfirm} disabled={!allValid}>
            Confirmar ({decisions.size}/{unmatched.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
