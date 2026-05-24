import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { DuplicateGroup } from "@/hooks/useD1Schedules";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string | null;
  unitName: string;
  groups: DuplicateGroup[];
}

export function D1MergeDuplicatesDialog({ open, onOpenChange, unitId, unitName, groups }: Props) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const mergeable = useMemo(() => groups.filter((g) => !!g.canonical), [groups]);
  const blocked = useMemo(() => groups.filter((g) => !g.canonical), [groups]);

  async function handleMerge() {
    if (!unitId || mergeable.length === 0) return;
    setRunning(true);
    try {
      const pairs = mergeable.map((g) => ({
        keep_id: g.canonical!.id,
        merge_ids: g.members.filter((m) => m.id !== g.canonical!.id).map((m) => m.id),
      }));
      const { data, error } = await supabase.rpc("merge_employees_into_secullum", {
        p_unit_id: unitId,
        p_pairs: pairs as any,
      });
      if (error) throw error;
      const r = data as any;
      toast.success(
        `Fusão concluída: ${r.employees_deleted} cadastros mesclados, ` +
          `${r.schedules_moved} escalas movidas${r.schedules_cancelled ? `, ${r.schedules_cancelled} canceladas por conflito` : ""}.`,
        { duration: 8000 }
      );
      qc.invalidateQueries({ queryKey: ["d1-schedules"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao fundir cadastros.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Fundir cadastros duplicados — {unitName}
          </DialogTitle>
          <DialogDescription>
            Move todas as escalas, lançamentos e check-ins dos cadastros duplicados para o
            cadastro canônico vindo do Secullum, e apaga os duplicados. Essa ação é definitiva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {mergeable.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Prontos para fundir ({mergeable.length})
              </p>
              {mergeable.map((g) => (
                <div key={g.identity_key} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-0 gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Secullum
                    </Badge>
                    <span className="font-semibold text-sm uppercase">{g.canonical!.name}</span>
                    {g.canonical!.cpf && (
                      <span className="text-xs text-muted-foreground">CPF {g.canonical!.cpf}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      id Secullum: {g.canonical!.secullum_id}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground pl-2 border-l-2 border-muted ml-1 space-y-0.5">
                    <p className="font-medium">Será mesclado:</p>
                    {g.members
                      .filter((m) => m.id !== g.canonical!.id)
                      .map((m) => (
                        <div key={m.id} className="flex items-center gap-2 flex-wrap">
                          <span className="uppercase">{m.name}</span>
                          <span>•</span>
                          <span>{m.schedule_count} escala(s)</span>
                          <span>•</span>
                          <span>criado {format(new Date(m.created_at), "dd/MM/yy")}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {blocked.length > 0 && (
            <Alert variant="default" className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs">
                <p className="font-medium mb-1">
                  {blocked.length} grupo(s) sem cadastro Secullum — aguardando próximo sync:
                </p>
                <ul className="list-disc list-inside">
                  {blocked.map((g) => (
                    <li key={g.identity_key} className="uppercase">
                      {g.members.map((m) => m.name).join(" / ")}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {mergeable.length === 0 && blocked.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sem duplicidades detectadas nesta unidade.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>
            Cancelar
          </Button>
          <Button onClick={handleMerge} disabled={running || mergeable.length === 0}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fundir {mergeable.length} grupo(s) no Secullum
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
