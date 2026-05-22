import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lojaId: string;
  lojaNome: string;
  onSaved: (cnpj: string) => void;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const maskCnpj = (s: string): string => {
  const d = onlyDigits(s).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

// Validação oficial de DV do CNPJ
const isValidCnpj = (raw: string): boolean => {
  const d = onlyDigits(raw);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (slice: string, weights: number[]) => {
    const sum = slice
      .split("")
      .reduce((acc, n, i) => acc + parseInt(n, 10) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calc(d.slice(0, 12), w1);
  const dv2 = calc(d.slice(0, 13), w2);
  return dv1 === parseInt(d[12], 10) && dv2 === parseInt(d[13], 10);
};

export function CnpjQuickRegisterDialog({
  open,
  onOpenChange,
  lojaId,
  lojaNome,
  onSaved,
}: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  const digits = onlyDigits(value);
  const valid = isValidCnpj(value);
  const showError = digits.length === 14 && !valid;

  const handleSave = async () => {
    if (!valid) {
      toast.error("CNPJ inválido. Verifique os dígitos.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("config_lojas")
        .update({ cnpj: digits })
        .eq("id", lojaId);

      if (error) {
        if (error.code === "42501" || error.message?.toLowerCase().includes("row-level")) {
          toast.error("Apenas administradores podem cadastrar o CNPJ.");
        } else {
          toast.error(`Erro ao salvar CNPJ: ${error.message}`);
        }
        return;
      }
      toast.success(`CNPJ cadastrado para ${lojaNome}.`);
      onSaved(digits);
      onOpenChange(false);
    } catch (err) {
      console.error("CNPJ save error:", err);
      toast.error("Erro inesperado ao salvar CNPJ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar CNPJ da unidade</DialogTitle>
          <DialogDescription>
            O CNPJ é obrigatório para gerar o CSV de pagamento do ERP. Esta
            unidade ainda não tem CNPJ cadastrado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
              {lojaNome}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cnpj-input">CNPJ</Label>
            <Input
              id="cnpj-input"
              autoFocus
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={value}
              maxLength={18}
              onChange={(e) => setValue(maskCnpj(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid && !saving) handleSave();
              }}
              className={showError ? "border-destructive" : ""}
            />
            {showError && (
              <p className="text-xs text-destructive">
                CNPJ inválido — dígitos verificadores não conferem.
              </p>
            )}
            {!showError && digits.length > 0 && digits.length < 14 && (
              <p className="text-xs text-muted-foreground">
                {digits.length}/14 dígitos
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!valid || saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar e gerar CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
