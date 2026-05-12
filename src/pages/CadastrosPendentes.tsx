import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Send,
  ShieldAlert,
  Pencil,
  PhoneOff,
  UserMinus,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import EditPixModal from "@/components/cadastros-pendentes/EditPixModal";
import BatchDispatchDrawer, {
  type DispatchQueueItem,
} from "@/components/cadastros-pendentes/BatchDispatchDrawer";

interface PendingProfile {
  id: string;
  nome_completo: string;
  cpf: string;
  telefone: string | null;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  inativo: boolean;
  ultima_escala: string | null;
  ultima_unidade: string | null;
  is_active_90d: boolean;
}

const BATCH_LIMIT = 100;

export default function CadastrosPendentes() {
  const profileData = useUserProfile() as unknown as { isAdmin?: boolean; isOperator?: boolean } | null;
  const isAdmin = !!profileData?.isAdmin;
  const isOperator = !!profileData?.isOperator;
  const canSee = isAdmin || isOperator;

  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<PendingProfile | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [batchItems, setBatchItems] = useState<DispatchQueueItem[] | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cadastros-pendentes"],
    enabled: !!canSee,
    queryFn: async (): Promise<PendingProfile[]> => {
      // Pull all pending profiles (tipo NULL)
      const { data: profiles, error } = await supabase
        .from("freelancer_profiles")
        .select("id, nome_completo, cpf, telefone, chave_pix, tipo_chave_pix")
        .is("tipo_chave_pix", null)
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      const profileIds = (profiles ?? []).map((p) => p.id);
      if (profileIds.length === 0) return [];

      const cpfs = (profiles ?? []).map((p) =>
        (p.cpf || "").replace(/\D/g, "")
      );

      // Fetch employees by cpf to bridge profile -> employees -> schedules
      const { data: employees } = await supabase
        .from("employees")
        .select("id, cpf, unit_id")
        .eq("worker_type", "freelancer");

      const cpfToEmpIds = new Map<string, string[]>();
      const empIdToUnit = new Map<string, string>();
      (employees ?? []).forEach((e) => {
        const cleaned = (e.cpf || "").replace(/\D/g, "");
        if (!cleaned) return;
        const arr = cpfToEmpIds.get(cleaned) ?? [];
        arr.push(e.id);
        cpfToEmpIds.set(cleaned, arr);
        if (e.unit_id) empIdToUnit.set(e.id, e.unit_id);
      });

      const allEmpIds = Array.from(empIdToUnit.keys());
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      // Fetch most recent schedule for these employees
      const empToLast = new Map<string, { date: string; unit_id: string }>();
      if (allEmpIds.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < allEmpIds.length; i += chunkSize) {
          const chunk = allEmpIds.slice(i, i + chunkSize);
          const { data: scheds } = await supabase
            .from("schedules")
            .select("employee_id, schedule_date")
            .in("employee_id", chunk)
            .order("schedule_date", { ascending: false });
          (scheds ?? []).forEach((s) => {
            const prev = empToLast.get(s.employee_id);
            if (!prev || s.schedule_date > prev.date) {
              empToLast.set(s.employee_id, {
                date: s.schedule_date,
                unit_id: empIdToUnit.get(s.employee_id) ?? "",
              });
            }
          });
        }
      }

      // Fetch unit names
      const unitIds = Array.from(
        new Set(Array.from(empToLast.values()).map((v) => v.unit_id).filter(Boolean))
      );
      const unitNames = new Map<string, string>();
      if (unitIds.length > 0) {
        const { data: lojas } = await supabase
          .from("config_lojas")
          .select("id, nome")
          .in("id", unitIds);
        (lojas ?? []).forEach((l) => unitNames.set(l.id, l.nome));
      }

      return (profiles ?? []).map((p, i) => {
        const cleanedCpf = cpfs[i];
        const empIds = cpfToEmpIds.get(cleanedCpf) ?? [];
        let last: { date: string; unit_id: string } | undefined;
        for (const eid of empIds) {
          const cand = empToLast.get(eid);
          if (cand && (!last || cand.date > last.date)) last = cand;
        }
        return {
          id: p.id,
          nome_completo: p.nome_completo,
          cpf: p.cpf,
          telefone: p.telefone,
          chave_pix: p.chave_pix,
          tipo_chave_pix: p.tipo_chave_pix,
          ultima_escala: last?.date ?? null,
          ultima_unidade: last ? unitNames.get(last.unit_id) ?? null : null,
          is_active_90d: !!last && last.date >= cutoff,
        } satisfies PendingProfile;
      });
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return showInactive ? data : data.filter((p) => p.is_active_90d);
  }, [data, showInactive]);

  const counters = useMemo(() => {
    const total = data?.length ?? 0;
    const active = data?.filter((p) => p.is_active_90d).length ?? 0;
    const inactive = total - active;
    const noPhone = filtered.filter((p) => !p.telefone || p.telefone.replace(/\D/g, "").length < 10).length;
    return { total, active, inactive, noPhone };
  }, [data, filtered]);

  if (!canSee) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <CardTitle>Acesso restrito</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Esta tela é exclusiva para administradores e operadores
            financeiros.
          </CardContent>
        </Card>
      </div>
    );
  }

  const toggleSel = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else {
        if (n.size >= BATCH_LIMIT) {
          toast.error(`Limite de ${BATCH_LIMIT} por sessão.`);
          return n;
        }
        n.add(id);
      }
      return n;
    });
  };

  const selectAllVisible = () => {
    const eligible = filtered.filter(
      (p) => p.telefone && p.telefone.replace(/\D/g, "").length >= 10
    );
    const limited = eligible.slice(0, BATCH_LIMIT);
    setSelected(new Set(limited.map((p) => p.id)));
  };

  const handleDispatchSelected = async () => {
    const items = filtered.filter((p) => selected.has(p.id));
    if (items.length === 0) {
      toast.error("Nenhum freelancer selecionado.");
      return;
    }
    setDispatching(true);
    const queue: DispatchQueueItem[] = [];
    for (const item of items) {
      try {
        const { data: res, error } = await supabase.functions.invoke(
          "generate-magic-pix-link",
          {
            body: {
              profile_id: item.id,
              base_url: window.location.origin,
            },
          }
        );
        if (error) throw error;
        const r = res as {
          ok: boolean;
          wa_me_url: string | null;
          message_body: string;
          url: string;
        };
        queue.push({
          profileId: item.id,
          nome: item.nome_completo,
          telefone: item.telefone,
          waMeUrl: r.wa_me_url,
          magicLink: r.url,
          messageBody: r.message_body,
          sent: false,
        });
      } catch (e) {
        queue.push({
          profileId: item.id,
          nome: item.nome_completo,
          telefone: item.telefone,
          waMeUrl: null,
          magicLink: "",
          messageBody: "",
          sent: false,
          error: String((e as Error)?.message ?? e),
        });
      }
    }
    setDispatching(false);
    setBatchItems(queue);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cadastros pendentes</h1>
          <p className="text-sm text-muted-foreground">
            Freelancers sem tipo de chave PIX definido. Disparar link mágico
            para autoatualização.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
              disabled={!isAdmin}
            />
            <label htmlFor="show-inactive" className="text-sm">
              Mostrar todos (inclui inativos)
              {!isAdmin && (
                <span className="text-muted-foreground ml-1">— admin</span>
              )}
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Total pendentes" value={counters.total} />
        <KpiTile label="Ativos (90d)" value={counters.active} accent />
        <KpiTile label="Inativos" value={counters.inactive} muted />
        <KpiTile label="Sem telefone (visíveis)" value={counters.noPhone} muted />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {filtered.length} freelancers visíveis · {selected.size}{" "}
            selecionado(s)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={selectAllVisible}
              disabled={filtered.length === 0}
            >
              Selecionar visíveis (até {BATCH_LIMIT})
            </Button>
            <Button
              size="sm"
              onClick={handleDispatchSelected}
              disabled={dispatching || selected.size === 0}
            >
              {dispatching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Disparar em lote via wa.me
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Chave atual</TableHead>
                    <TableHead>Última escala</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const phoneOk =
                      !!p.telefone &&
                      p.telefone.replace(/\D/g, "").length >= 10;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(p.id)}
                            onCheckedChange={() => toggleSel(p.id)}
                            disabled={!phoneOk}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {p.nome_completo}
                          {!p.is_active_90d && (
                            <Badge variant="outline" className="ml-2">
                              inativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {maskCpf(p.cpf)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {phoneOk ? (
                            p.telefone
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <PhoneOff className="h-3 w-3" /> Sem telefone
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.chave_pix ? maskKey(p.chave_pix) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.ultima_escala ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.ultima_unidade ?? "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(p)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelected(new Set([p.id]));
                              setTimeout(() => handleDispatchSelected(), 0);
                            }}
                            disabled={!phoneOk || dispatching}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" /> Link
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                        Sem pendências no filtro atual.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditPixModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}

      {batchItems && (
        <BatchDispatchDrawer
          items={batchItems}
          onClose={() => {
            setBatchItems(null);
            setSelected(new Set());
            refetch();
          }}
        />
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={`text-2xl font-semibold ${accent ? "text-primary" : muted ? "text-muted-foreground" : ""}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function maskCpf(cpf: string): string {
  const d = (cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11).replace(/.(?=.)/g, "X")}`;
}

function maskKey(k: string): string {
  if (!k) return "";
  if (k.length <= 4) return "*".repeat(k.length);
  return `${k.slice(0, 2)}${"*".repeat(Math.max(2, k.length - 4))}${k.slice(-2)}`;
}
