import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSetores, useSetorItems, useInventarios, useInventarioItems, useCreateInventario, useSaveInventarioItems, useConcluirInventario } from "@/hooks/useEstoque";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Plus, ClipboardList, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

export function Inventarios() {
  const { effectiveUnidadeId } = useUnidade();
  const { profile } = useUserProfile();
  const { data: setores } = useSetores();
  const { data: setorItems } = useSetorItems(effectiveUnidadeId);
  const { data: inventarios, isLoading } = useInventarios(effectiveUnidadeId);
  const createInv = useCreateInventario();
  const saveItems = useSaveInventarioItems();
  const concluir = useConcluirInventario();
  const isMobile = useIsMobile();

  const [showNew, setShowNew] = useState(false);
  const [newSetorId, setNewSetorId] = useState("");
  const [newTipo, setNewTipo] = useState("DIARIO");
  const [newTurno, setNewTurno] = useState("ABERTURA");
  const [newData, setNewData] = useState(format(new Date(), "yyyy-MM-dd"));

  const [activeInvId, setActiveInvId] = useState<string | null>(null);
  const { data: activeItems } = useInventarioItems(activeInvId);
  const [contagens, setContagens] = useState<Record<string, number>>({});

  const handleCreateInventario = () => {
    if (!newSetorId || !effectiveUnidadeId) return;
    const now = new Date();
    const week = `${now.getFullYear()}-W${String(Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, "0")}`;
    createInv.mutate({
      setor_id: newSetorId, loja_id: effectiveUnidadeId, tipo: newTipo,
      turno: newTipo === "DIARIO" ? newTurno : undefined, data_inventario: newData,
      semana_referencia: week, responsavel: profile?.full_name || "—",
    }, {
      onSuccess: (data) => {
        setShowNew(false);
        const sectorItems = setorItems?.filter((si: any) => si.setor_id === newSetorId) || [];
        if (sectorItems.length > 0 && data?.id) {
          const items = sectorItems.map((si: any) => ({ inventario_id: data.id, setor_item_id: si.id, quantidade_anterior: 0, quantidade_contada: 0 }));
          saveItems.mutate(items);
          setActiveInvId(data.id);
        }
      },
    });
  };

  const handleSaveContagens = () => {
    if (!activeInvId || !activeItems) return;
    concluir.mutate(activeInvId, { onSuccess: () => setActiveInvId(null) });
  };

  if (!effectiveUnidadeId) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Inventários</h3>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Inventário</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Setor</Label>
                <Select value={newSetorId} onValueChange={setNewSetorId}><SelectTrigger><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
                  <SelectContent>{setores?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Tipo</Label>
                  <Select value={newTipo} onValueChange={setNewTipo}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="DIARIO">Diário</SelectItem><SelectItem value="SEMANAL">Semanal</SelectItem></SelectContent></Select></div>
                {newTipo === "DIARIO" && (
                  <div><Label>Turno</Label>
                    <Select value={newTurno} onValueChange={setNewTurno}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="ABERTURA">Abertura</SelectItem><SelectItem value="FECHAMENTO">Fechamento</SelectItem></SelectContent></Select></div>
                )}
              </div>
              <div><Label>Data</Label><Input type="date" value={newData} onChange={(e) => setNewData(e.target.value)} /></div>
              <Button onClick={handleCreateInventario} disabled={!newSetorId || createInv.isPending} className="w-full">Criar Inventário</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active inventory counting */}
      {activeInvId && activeItems && (
        <Card className="border-primary">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Contagem em Andamento</CardTitle>
            <Button onClick={handleSaveContagens} disabled={concluir.isPending} size={isMobile ? "sm" : "default"}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Concluir
            </Button>
          </CardHeader>
          <CardContent className={isMobile ? "space-y-3" : "p-0"}>
            {isMobile ? (
              activeItems.map((item: any) => {
                const contagem = contagens[item.id] ?? item.quantidade_contada ?? 0;
                const variacao = contagem - (item.quantidade_anterior || 0);
                return (
                  <Card key={item.id} className="border">
                    <CardContent className="p-3 space-y-2">
                      <p className="font-medium text-sm">{item.setor_items?.items_catalog?.name}</p>
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Anterior</p>
                          <p className="font-mono text-sm">{item.quantidade_anterior}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground text-center">Contagem</p>
                          <Input type="number" min="0" className="text-center h-8" value={contagem}
                            onChange={(e) => setContagens(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Variação</p>
                          <p className={`font-mono text-sm ${variacao < 0 ? "text-destructive" : variacao > 0 ? "text-green-600" : ""}`}>
                            {variacao > 0 ? `+${variacao}` : variacao}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Item</TableHead><TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Contagem</TableHead><TableHead className="text-right">Variação</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {activeItems.map((item: any) => {
                    const contagem = contagens[item.id] ?? item.quantidade_contada ?? 0;
                    const variacao = contagem - (item.quantidade_anterior || 0);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.setor_items?.items_catalog?.name}</TableCell>
                        <TableCell className="text-right font-mono">{item.quantidade_anterior}</TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min="0" className="w-20 ml-auto text-right" value={contagem}
                            onChange={(e) => setContagens(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))} />
                        </TableCell>
                        <TableCell className={`text-right font-mono ${variacao < 0 ? "text-red-500" : variacao > 0 ? "text-green-500" : ""}`}>
                          {variacao > 0 ? `+${variacao}` : variacao}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Histórico</CardTitle></CardHeader>
        <CardContent className={isMobile ? "space-y-3" : "p-0"}>
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (!inventarios || inventarios.length === 0) ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum inventário realizado.</p>
          ) : isMobile ? (
            inventarios.map((inv: any) => (
              <Card key={inv.id} className="border">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{inv.setores?.nome}</p>
                    <Badge variant={inv.status === "CONCLUIDO" ? "default" : "outline"} className={inv.status === "CONCLUIDO" ? "bg-green-600" : ""}>{inv.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{format(new Date(inv.data_inventario), "dd/MM/yyyy")}</span>
                    <span>{inv.tipo} {inv.turno ? `· ${inv.turno}` : ""}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">{inv.responsavel}</span>
                    {inv.status === "ABERTO" && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveInvId(inv.id)}><ClipboardList className="h-4 w-4 mr-1" />Contar</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Setor</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Turno</TableHead><TableHead>Responsável</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {inventarios.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell>{format(new Date(inv.data_inventario), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{inv.setores?.nome}</TableCell>
                    <TableCell>{inv.tipo}</TableCell>
                    <TableCell>{inv.turno || "—"}</TableCell>
                    <TableCell className="text-sm">{inv.responsavel}</TableCell>
                    <TableCell><Badge variant={inv.status === "CONCLUIDO" ? "default" : "outline"} className={inv.status === "CONCLUIDO" ? "bg-green-600" : ""}>{inv.status}</Badge></TableCell>
                    <TableCell>{inv.status === "ABERTO" && <Button variant="ghost" size="sm" onClick={() => setActiveInvId(inv.id)}><ClipboardList className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
