import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Clock, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { useFreelancerEntries } from "@/hooks/useFreelancerEntries";
import { useCpfLookup } from "@/hooks/useCpfLookup";
import { formatCPF, formatCurrencyInput, isValidCPF } from "@/lib/formatters";
import type { FreelancerEntry } from "@/types/freelancer";
import { useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";

interface Props {
  selectedUnidadeId?: string | null;
  allowedLojaIds?: string[] | null;
}

export function SolicitacoesPendentes({ selectedUnidadeId, allowedLojaIds }: Props) {
  const { entries } = useFreelancerEntries();
  const [editing, setEditing] = useState<FreelancerEntry | null>(null);

  const pending = useMemo(() => {
    return entries.filter((e) => {
      if (e.status !== "pendente") return false;
      if (selectedUnidadeId) return e.loja_id === selectedUnidadeId;
      if (allowedLojaIds && allowedLojaIds.length > 0) return e.loja_id && allowedLojaIds.includes(e.loja_id);
      return true;
    });
  }, [entries, selectedUnidadeId, allowedLojaIds]);

  if (pending.length === 0) return null;

  return (
    <>
      <Card className="rounded-2xl border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/10">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base uppercase flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            Solicitações de Freelancer Pendentes
            <Badge variant="secondary">{pending.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.map((p) => {
            const [y, m, d] = p.data_pop.split("-");
            return (
              <div
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border bg-background p-3"
              >
                <div className="text-sm">
                  <div className="font-medium">
                    {p.loja} — {d}/{m}/{y}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {p.setor} · {p.funcao}
                    {p.hora_inicio && p.hora_fim
                      ? ` · ${p.hora_inicio.slice(0,5)}–${p.hora_fim.slice(0,5)}${p.hora_fim.slice(0,5) < p.hora_inicio.slice(0,5) ? " (+1d)" : ""}`
                      : ""}
                    {" · "}Cobrindo {p.substitui} · {p.motivo}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Solicitado por {p.solicitante_nome}
                    {p.solicitante_telefone ? ` (${p.solicitante_telefone})` : ""}
                  </div>
                </div>
                <Button size="sm" onClick={() => setEditing(p)}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Completar cadastro
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {editing && (
        <CompletarDialog entry={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function CompletarDialog({ entry, onClose }: { entry: FreelancerEntry; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { lookupUnifiedByCpf, isLookingUp } = useCpfLookup();

  const [cpf, setCpf] = useState<string>(entry.cpf ? formatCPF(entry.cpf) : "");
  const [nome, setNome] = useState<string>(entry.nome_completo ?? "");
  const [chavePix, setChavePix] = useState<string>(entry.chave_pix ?? "");
  const [valorStr, setValorStr] = useState<string>(entry.valor ? formatCurrencyInput(String(Math.round(entry.valor * 100))) : "");
  const [saving, setSaving] = useState(false);

  const valorNum = useMemo(() => {
    const digits = valorStr.replace(/\D/g, "");
    if (!digits) return 0;
    return parseInt(digits, 10) / 100;
  }, [valorStr]);

  const handleCpfChange = async (raw: string) => {
    const formatted = formatCPF(raw);
    setCpf(formatted);
    const clean = formatted.replace(/\D/g, "");
    if (clean.length === 11) {
      const unified = await lookupUnifiedByCpf(clean);
      if (unified) {
        if (!nome) setNome(unified.nome_completo);
        if (!chavePix && unified.chave_pix) setChavePix(unified.chave_pix);
      }
    }
  };

  const handleSave = async () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (!isValidCPF(cpf)) return toast.error("CPF inválido.");
    if (nome.trim().length < 2) return toast.error("Informe o nome completo.");
    if (!chavePix.trim()) return toast.error("Informe a chave PIX.");
    if (!valorNum || valorNum <= 0) return toast.error("Informe o valor da diária.");

    setSaving(true);
    const { error } = await supabase
      .from("freelancer_entries")
      .update({
        nome_completo: nome.trim(),
        cpf: cleanCpf,
        chave_pix: chavePix.trim(),
        valor: valorNum,
        status: "confirmado",
        origem: "manual",
      })
      .eq("id", entry.id);

    if (error) {
      setSaving(false);
      console.error(error);
      toast.error(error.message || "Erro ao completar cadastro.");
      return;
    }

    // Espelha no cadastro global de freelancers
    await supabase.from("freelancer_profiles").upsert(
      { cpf: cleanCpf, nome_completo: nome.trim(), chave_pix: chavePix.trim(), tenant_id: tenantId },
      { onConflict: "cpf", ignoreDuplicates: false }
    );

    queryClient.invalidateQueries({ queryKey: ["freelancer-entries", tenantId] });
    toast.success("Cadastro concluído — lançamento confirmado.");
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase">Completar cadastro do freelancer</DialogTitle>
          <DialogDescription>
            {entry.loja} — {entry.data_pop.split("-").reverse().join("/")} · {entry.setor} / {entry.funcao}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>CPF</Label>
            <div className="relative">
              <Input value={cpf} onChange={(e) => handleCpfChange(e.target.value)} placeholder="000.000.000-00" />
              {isLookingUp && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do freelancer" />
          </div>
          <div className="space-y-1.5">
            <Label>Chave PIX</Label>
            <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder="CPF, e-mail ou telefone" />
          </div>
          <div className="space-y-1.5">
            <Label>Valor da diária</Label>
            <Input
              value={valorStr}
              onChange={(e) => setValorStr(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Confirmar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
