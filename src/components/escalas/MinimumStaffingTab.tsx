import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUnidade } from "@/contexts/UnidadeContext";

const DIAS_SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
const TURNOS = ["MANHA", "TARDE", "NOITE", "ALMOCO", "JANTAR"] as const;
const SETORES = ["salao", "delivery", "cozinha", "bar", "parrilla", "sushi", "caixa"] as const;

/**
 * Aba "Escalas Mínimas" — Plano de Chão.
 * Disponível somente para administradores. Anteriormente vivia
 * dentro de Central Holding.
 */
export function MinimumStaffingTab() {
  const { isAdmin } = useUserProfile();
  const { effectiveUnidadeId } = useUnidade();
  const queryClient = useQueryClient();

  const [unidade, setUnidade] = useState<string>(effectiveUnidadeId ?? "");
  const [open, setOpen] = useState(false);

  const { data: lojas } = useQuery({
    queryKey: ["minimum-staffing-lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_lojas")
        .select("id, nome")
        .order("nome", { ascending: true })
        .range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: pracas, isLoading } = useQuery({
    queryKey: ["minimum-staffing-pracas", unidade],
    queryFn: async () => {
      if (!unidade) return [];
      const { data, error } = await supabase
        .from("pracas_plano_chao")
        .select("*")
        .eq("unit_id", unidade)
        .order("dia_semana", { ascending: true })
        .range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin && !!unidade,
  });

  const updateQtd = useMutation({
    mutationFn: async ({ id, qtd }: { id: string; qtd: number }) => {
      const { error } = await supabase
        .from("pracas_plano_chao")
        .update({ qtd_necessaria: qtd })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minimum-staffing-pracas", unidade] });
      toast.success("Praça atualizada.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isAdmin) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Apenas administradores podem visualizar e editar as escalas mínimas.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Escalas Mínimas (Plano de Chão)</CardTitle>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!unidade} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Praça
            </Button>
          </DialogTrigger>
          <NovaPracaDialog unitId={unidade} onClose={() => setOpen(false)} />
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Unidade</Label>
          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma unidade" />
            </SelectTrigger>
            <SelectContent>
              {(lojas ?? []).map((l: any) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!unidade ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Selecione uma unidade para ver as praças.
          </p>
        ) : isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !pracas || pracas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma praça configurada para esta unidade.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Praça</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead className="w-32 text-right">Qtd Necessária</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pracas.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome_praca}</TableCell>
                    <TableCell className="text-xs uppercase">{p.setor}</TableCell>
                    <TableCell className="text-xs uppercase">{p.turno}</TableCell>
                    <TableCell className="text-xs uppercase">{p.dia_semana}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        defaultValue={p.qtd_necessaria}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (val !== Number(p.qtd_necessaria)) {
                            updateQtd.mutate({ id: p.id, qtd: val });
                          }
                        }}
                        className="h-8 w-24 text-right text-sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NovaPracaDialog({
  unitId,
  onClose,
}: {
  unitId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [nomePraca, setNomePraca] = useState("");
  const [setor, setSetor] = useState<string>("");
  const [turno, setTurno] = useState<string>("");
  const [diaSemana, setDiaSemana] = useState<string>("");
  const [qtd, setQtd] = useState<string>("1");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pracas_plano_chao").insert({
        unit_id: unitId,
        nome_praca: nomePraca.trim(),
        setor,
        turno,
        dia_semana: diaSemana,
        qtd_necessaria: Number(qtd) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minimum-staffing-pracas", unitId] });
      toast.success("Praça criada com sucesso!");
      setNomePraca("");
      setSetor("");
      setTurno("");
      setDiaSemana("");
      setQtd("1");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao criar praça."),
  });

  const canSubmit = unitId && nomePraca.trim() && setor && turno && diaSemana;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nova Praça</DialogTitle>
        <DialogDescription>
          Adicione uma nova posição mínima ao plano de chão da unidade.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="space-y-1.5">
          <Label>Nome da Praça</Label>
          <Input
            value={nomePraca}
            onChange={(e) => setNomePraca(e.target.value)}
            placeholder="Ex.: Praça do Salão Direita"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Setor</Label>
            <Select value={setor} onValueChange={setSetor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {SETORES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Turno</Label>
            <Select value={turno} onValueChange={setTurno}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TURNOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Dia da Semana</Label>
            <Select value={diaSemana} onValueChange={setDiaSemana}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {DIAS_SEMANA.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Qtd Necessária</Label>
            <Input
              type="number"
              min="1"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => create.mutate()}
          disabled={!canSubmit || create.isPending}
        >
          {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar Praça
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
