import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSetores, useSetorItems, useMovimentacoes, useCreateMovimentacao } from "@/hooks/useEstoque";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const tipoIcons: Record<string, any> = {
  ENTRADA: ArrowUpCircle,
  SAIDA: ArrowDownCircle,
  AJUSTE: RefreshCw,
  TRANSFERENCIA: ArrowRightLeft,
};

const tipoColors: Record<string, string> = {
  ENTRADA: "bg-green-600",
  SAIDA: "bg-red-600",
  AJUSTE: "bg-yellow-600",
  TRANSFERENCIA: "bg-blue-600",
};

export function Movimentacao() {
  const { effectiveUnidadeId } = useUnidade();
  const { profile } = useUserProfile();
  const { data: setores } = useSetores();
  const { data: setorItems } = useSetorItems(effectiveUnidadeId);
  const { data: movimentacoes, isLoading } = useMovimentacoes(effectiveUnidadeId);
  const createMov = useCreateMovimentacao();

  const [tipo, setTipo] = useState("ENTRADA");
  const [setorItemId, setSetorItemId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [setorDestinoId, setSetorDestinoId] = useState("");
  const [observacao, setObservacao] = useState("");

  const handleSubmit = () => {
    if (!setorItemId || !quantidade || !effectiveUnidadeId) return;
    createMov.mutate({
      setor_item_id: setorItemId,
      loja_id: effectiveUnidadeId,
      tipo_movimentacao: tipo,
      quantidade: parseFloat(quantidade),
      setor_destino_id: tipo === "TRANSFERENCIA" ? setorDestinoId || undefined : undefined,
      responsavel: profile?.full_name || "—",
      observacao: observacao || undefined,
    }, {
      onSuccess: () => {
        setSetorItemId("");
        setQuantidade("");
        setObservacao("");
        setSetorDestinoId("");
      },
    });
  };

  if (!effectiveUnidadeId) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Nova Movimentação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada</SelectItem>
                  <SelectItem value="SAIDA">Saída</SelectItem>
                  <SelectItem value="AJUSTE">Ajuste</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Item</Label>
              <Select value={setorItemId} onValueChange={setSetorItemId}>
                <SelectTrigger><SelectValue placeholder="Selecionar item" /></SelectTrigger>
                <SelectContent>
                  {setorItems?.map((si: any) => (
                    <SelectItem key={si.id} value={si.id}>
                      {si.items_catalog?.name} ({si.setores?.nome})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min="0" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            {tipo === "TRANSFERENCIA" && (
              <div>
                <Label>Setor Destino</Label>
                <Select value={setorDestinoId} onValueChange={setSetorDestinoId}>
                  <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                  <SelectContent>
                    {setores?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
          <Button onClick={handleSubmit} disabled={!setorItemId || !quantidade || createMov.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Registrar Movimentação
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Histórico de Movimentações</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Obs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!movimentacoes || movimentacoes.length === 0) ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma movimentação registrada.</TableCell></TableRow>
                ) : movimentacoes.map((m: any) => {
                  const Icon = tipoIcons[m.tipo_movimentacao] || RefreshCw;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{format(new Date(m.data_movimentacao), "dd/MM/yy HH:mm")}</TableCell>
                      <TableCell>
                        <Badge className={`${tipoColors[m.tipo_movimentacao] || ""} text-xs`}>
                          <Icon className="h-3 w-3 mr-1" />{m.tipo_movimentacao}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{m.setor_items?.items_catalog?.name}</TableCell>
                      <TableCell className="text-xs">{m.setor_items?.setores?.nome}</TableCell>
                      <TableCell className="text-right font-mono">{m.quantidade}</TableCell>
                      <TableCell className="text-xs">{m.responsavel || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{m.observacao || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
