import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  META_LABELS,
  ORIGEM_LABELS,
  type CodigoMeta,
  type OrigemDado,
  type MetaCargo,
} from "@/hooks/useCargos";
import { Plus } from "lucide-react";

interface AddMetaDialogProps {
  cargoId: string;
  cargoNome: string;
  existingMetas: MetaCargo[];
  onCreate: (params: {
    cargo_id: string;
    codigo_meta: CodigoMeta;
    teto_valor: number;
    peso: number;
    origem_dado: OrigemDado;
    ativo: boolean;
  }) => Promise<void> | void;
  isPending?: boolean;
}

export function AddMetaDialog({
  cargoId,
  cargoNome,
  existingMetas,
  onCreate,
  isPending,
}: AddMetaDialogProps) {
  const [open, setOpen] = useState(false);
  const [codigoMeta, setCodigoMeta] = useState<CodigoMeta | "">("");
  const [tetoValor, setTetoValor] = useState("1000");
  const [peso, setPeso] = useState("1");
  const [origemDado, setOrigemDado] = useState<OrigemDado>("manual");
  const [ativo, setAtivo] = useState(true);

  const usedCodigos = new Set(existingMetas.map((m) => m.codigo_meta));
  const availableCodigos = (Object.keys(META_LABELS) as CodigoMeta[]).filter(
    (k) => !usedCodigos.has(k),
  );

  const reset = () => {
    setCodigoMeta("");
    setTetoValor("1000");
    setPeso("1");
    setOrigemDado("manual");
    setAtivo(true);
  };

  const handleSave = async () => {
    if (!codigoMeta) return;
    const teto = parseFloat(tetoValor.replace(",", "."));
    const pesoNum = parseFloat(peso.replace(",", "."));
    if (isNaN(teto) || teto < 0 || isNaN(pesoNum) || pesoNum < 0) return;

    await onCreate({
      cargo_id: cargoId,
      codigo_meta: codigoMeta as CodigoMeta,
      teto_valor: teto,
      peso: pesoNum,
      origem_dado: origemDado,
      ativo,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        disabled={availableCodigos.length === 0}
        title={
          availableCodigos.length === 0
            ? "Todos os tipos de meta já foram adicionados a este cargo"
            : "Adicionar nova variável"
        }
      >
        <Plus className="h-4 w-4" />
        Adicionar Variável
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Variável de Bônus</DialogTitle>
          <DialogDescription>
            Adicione uma variável de remuneração para <strong>{cargoNome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="codigo-meta">Tipo de Meta</Label>
            <Select
              value={codigoMeta}
              onValueChange={(v) => setCodigoMeta(v as CodigoMeta)}
            >
              <SelectTrigger id="codigo-meta">
                <SelectValue placeholder="Selecione o tipo de meta" />
              </SelectTrigger>
              <SelectContent>
                {availableCodigos.map((k) => (
                  <SelectItem key={k} value={k}>
                    {META_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="teto">Teto (R$)</Label>
              <Input
                id="teto"
                type="text"
                inputMode="decimal"
                value={tetoValor}
                onChange={(e) => setTetoValor(e.target.value)}
                placeholder="1000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="peso">Peso</Label>
              <Input
                id="peso"
                type="text"
                inputMode="decimal"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="origem">Origem do Dado</Label>
            <Select
              value={origemDado}
              onValueChange={(v) => setOrigemDado(v as OrigemDado)}
            >
              <SelectTrigger id="origem">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ORIGEM_LABELS) as OrigemDado[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {ORIGEM_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="ativo" className="cursor-pointer">
                Variável ativa
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inativas não entram no cálculo do bônus
              </p>
            </div>
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!codigoMeta || isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
