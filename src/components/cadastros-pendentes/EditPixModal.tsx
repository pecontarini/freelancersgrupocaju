import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  profile: {
    id: string;
    nome_completo: string;
    cpf: string;
    chave_pix: string | null;
    tipo_chave_pix: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
}

export default function EditPixModal({ profile, onClose, onSaved }: Props) {
  const [tipo, setTipo] = useState<"cpf" | "email" | "telefone">(
    (profile.tipo_chave_pix as "cpf" | "email" | "telefone") || "cpf"
  );
  const [chave, setChave] = useState(profile.chave_pix || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!chave.trim()) {
      toast.error("Informe a chave PIX.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("freelancer_profiles")
      .update({
        tipo_chave_pix: tipo,
        chave_pix: chave.trim(),
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Chave PIX atualizada.");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar PIX — {profile.nome_completo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <strong className="text-destructive">Atenção:</strong> a chave deve
            estar em nome do próprio freelancer. Edição passa pelo trigger de
            validação (modo permissivo — log em <code>pix_validation_log</code>).
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Chave PIX</Label>
            <Input value={chave} onChange={(e) => setChave(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
