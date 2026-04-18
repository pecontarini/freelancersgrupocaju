import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Check, RotateCcw, Loader2 } from "lucide-react";

export type AgendaCategoria = "reuniao" | "operacional" | "pessoal" | "outro";

export interface AgendaEventoForm {
  id?: string;
  titulo: string;
  descricao: string;
  data_inicio_date: string;
  data_inicio_time: string;
  data_fim_date: string;
  data_fim_time: string;
  categoria: AgendaCategoria;
  concluido: boolean;
  google_event_id?: string | null;
  syncGoogle: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<AgendaEventoForm>;
  onSubmit: (form: AgendaEventoForm) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onToggleConcluido?: () => Promise<void> | void;
  saving?: boolean;
  isEdit?: boolean;
}

const CATEGORIAS: { value: AgendaCategoria; label: string }[] = [
  { value: "reuniao", label: "Reunião" },
  { value: "operacional", label: "Operacional" },
  { value: "pessoal", label: "Pessoal" },
  { value: "outro", label: "Outro" },
];

export function AgendaEventModal({
  open,
  onOpenChange,
  initial,
  onSubmit,
  onDelete,
  onToggleConcluido,
  saving,
  isEdit,
}: Props) {
  const [form, setForm] = useState<AgendaEventoForm>(() => buildDefault(initial));

  useEffect(() => {
    if (open) setForm(buildDefault(initial));
  }, [open, initial]);

  const update = <K extends keyof AgendaEventoForm>(k: K, v: AgendaEventoForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.data_inicio_date || !form.data_inicio_time) return;
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={form.titulo}
              onChange={(e) => update("titulo", e.target.value)}
              placeholder="Ex: Reunião semanal"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={form.descricao}
              onChange={(e) => update("descricao", e.target.value)}
              rows={3}
              placeholder="Detalhes do evento (opcional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dt-ini">Data início *</Label>
              <Input
                id="dt-ini"
                type="date"
                value={form.data_inicio_date}
                onChange={(e) => update("data_inicio_date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr-ini">Hora início *</Label>
              <Input
                id="hr-ini"
                type="time"
                value={form.data_inicio_time}
                onChange={(e) => update("data_inicio_time", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dt-fim">Data fim</Label>
              <Input
                id="dt-fim"
                type="date"
                value={form.data_fim_date}
                onChange={(e) => update("data_fim_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr-fim">Hora fim</Label>
              <Input
                id="hr-fim"
                type="time"
                value={form.data_fim_time}
                onChange={(e) => update("data_fim_time", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.categoria} onValueChange={(v) => update("categoria", v as AgendaCategoria)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="sync" className="cursor-pointer">
                Sincronizar com Google Calendar
              </Label>
              <p className="text-xs text-muted-foreground">
                {isEdit && form.google_event_id
                  ? "Evento vinculado ao Google"
                  : "Cria automaticamente no seu calendário Google"}
              </p>
            </div>
            <Switch
              id="sync"
              checked={form.syncGoogle}
              onCheckedChange={(v) => update("syncGoogle", v)}
            />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              {isEdit && onDelete && (
                <Button type="button" variant="destructive" size="sm" onClick={() => onDelete()} disabled={saving}>
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir
                </Button>
              )}
              {isEdit && onToggleConcluido && (
                <Button
                  type="button"
                  variant={form.concluido ? "secondary" : "default"}
                  size="sm"
                  onClick={() => onToggleConcluido()}
                  disabled={saving}
                  className={!form.concluido ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                >
                  {form.concluido ? (
                    <>
                      <RotateCcw className="mr-1 h-4 w-4" /> Reabrir
                    </>
                  ) : (
                    <>
                      <Check className="mr-1 h-4 w-4" /> Concluir
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function buildDefault(initial?: Partial<AgendaEventoForm>): AgendaEventoForm {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    titulo: initial?.titulo ?? "",
    descricao: initial?.descricao ?? "",
    data_inicio_date: initial?.data_inicio_date ?? todayDate,
    data_inicio_time: initial?.data_inicio_time ?? nowTime,
    data_fim_date: initial?.data_fim_date ?? todayDate,
    data_fim_time: initial?.data_fim_time ?? nowTime,
    categoria: (initial?.categoria as AgendaCategoria) ?? "operacional",
    concluido: initial?.concluido ?? false,
    id: initial?.id,
    google_event_id: initial?.google_event_id ?? null,
    syncGoogle: initial?.syncGoogle ?? true,
  };
}
