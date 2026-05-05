import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  comentarioId: string;
  comentarioTexto?: string;
}

export function PlanoAcaoDialog({ open, onOpenChange, comentarioId, comentarioTexto }: Props) {
  const [texto, setTexto] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const handleSave = async () => {
    if (!texto.trim()) {
      toast.error("Descreva a ação corretiva.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Você precisa estar autenticado.");
      const { error } = await supabase.from("planos_acao").insert({
        comentario_id: comentarioId,
        texto_acao: texto.trim(),
        responsavel: responsavel.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Plano de ação registrado.");
      qc.invalidateQueries({ queryKey: ["planos_acao_count"] });
      setTexto("");
      setResponsavel("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar plano.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg backdrop-blur-xl bg-card/95 border-amber-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Criar Plano de Ação
          </DialogTitle>
          {comentarioTexto && (
            <DialogDescription className="text-xs italic line-clamp-3">
              "{comentarioTexto}"
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Descreva a ação corretiva *</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              placeholder="Ex.: Treinar equipe sobre tempo de espera; revisar processo de delivery..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Responsável (opcional)</Label>
            <Input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome do responsável pela execução"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !texto.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Salvar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
