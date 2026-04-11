import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSetores, useSetorItems, useLatestInventarioItems, useMovimentacoesAfterDate, useItemsCatalog } from "@/hooks/useEstoque";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Package, AlertTriangle, AlertCircle, Search, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function VisaoConsolidada() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: setores, isLoading: loadingSetores } = useSetores();
  const { data: setorItems, isLoading: loadingItems } = useSetorItems(effectiveUnidadeId);
  const { data: catalog } = useItemsCatalog();
  const { data: invItems } = useLatestInventarioItems(effectiveUnidadeId);
  const { data: movimentacoes } = useMovimentacoesAfterDate(effectiveUnidadeId);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterSetor, setFilterSetor] = useState("all");
  const [filterGrupo, setFilterGrupo] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Build cost lookup from catalog
  const costMap = useMemo(() => {
    const map: Record<string, number> = {};
    catalog?.forEach((c: any) => { map[c.id] = c.preco_custo || 0; });
    return map;
  }, [catalog]);

  // Build balance from last inventário + movimentações
  const balanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    // Latest count per setor_item
    const latestCount: Record<string, number> = {};
    invItems?.forEach((ii: any) => {
      if (!latestCount[ii.setor_item_id]) {
        latestCount[ii.setor_item_id] = ii.quantidade_contada || 0;
      }
    });
    // Movimentações
    const movMap: Record<string, number> = {};
    movimentacoes?.forEach((m: any) => {
      const key = m.setor_item_id;
      if (!movMap[key]) movMap[key] = 0;
      if (m.tipo_movimentacao === "ENTRADA") movMap[key] += m.quantidade;
      else if (m.tipo_movimentacao === "SAIDA" || m.tipo_movimentacao === "TRANSFERENCIA") movMap[key] -= m.quantidade;
      else if (m.tipo_movimentacao === "AJUSTE") movMap[key] += m.quantidade;
    });

    setorItems?.forEach((si: any) => {
      const count = latestCount[si.id] ?? 0;
      const mov = movMap[si.id] ?? 0;
      map[si.id] = count + mov;
    });
    return map;
  }, [setorItems, invItems, movimentacoes]);

  const itemsWithStatus = useMemo(() => {
    if (!setorItems) return [];
    return setorItems.map((si: any) => {
      const saldo = balanceMap[si.id] ?? 0;
      const custo = costMap[si.catalog_item_id] || 0;
      const status =
        si.ponto_pedido && saldo < si.ponto_pedido
          ? "critico"
          : saldo < si.estoque_minimo
          ? "alerta"
          : "ok";
      return { ...si, saldo, custo, valorTotal: saldo * custo, status };
    });
  }, [setorItems, balanceMap, costMap]);

  const grupos = useMemo(() => {
    const g = new Set<string>();
    itemsWithStatus.forEach((i: any) => {
      if (i.items_catalog?.grupo) g.add(i.items_catalog.grupo);
    });
    return Array.from(g).sort();
  }, [itemsWithStatus]);

  const filtered = useMemo(() => {
    return itemsWithStatus.filter((i: any) => {
      if (searchTerm && !i.items_catalog?.name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterSetor !== "all" && i.setor_id !== filterSetor) return false;
      if (filterGrupo !== "all" && i.items_catalog?.grupo !== filterGrupo) return false;
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      return true;
    });
  }, [itemsWithStatus, searchTerm, filterSetor, filterGrupo, filterStatus]);

  const sectorSummary = useMemo(() => {
    if (!setores || !itemsWithStatus.length) return [];
    return setores.map((s: any) => {
      const items = itemsWithStatus.filter((i: any) => i.setor_id === s.id);
      return {
        ...s,
        total: items.length,
        alerta: items.filter((i: any) => i.status === "alerta").length,
        critico: items.filter((i: any) => i.status === "critico").length,
        valorTotal: items.reduce((sum: number, i: any) => sum + i.valorTotal, 0),
      };
    });
  }, [setores, itemsWithStatus]);

  if (loadingSetores || loadingItems) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  if (!effectiveUnidadeId) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground">
        Selecione uma unidade para visualizar o estoque.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {sectorSummary.map((s: any) => (
          <Card key={s.id} className="cursor-pointer hover:ring-2 ring-primary/30 transition-all" onClick={() => setFilterSetor(filterSetor === s.id ? "all" : s.id)}>
            <CardContent className="p-4 text-center">
              <Package className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="font-semibold text-sm">{s.nome}</p>
              <p className="text-2xl font-bold">{s.total}</p>
              <p className="text-xs text-muted-foreground">R$ {s.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <div className="flex justify-center gap-2 mt-1">
                {s.alerta > 0 && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />{s.alerta}
                  </Badge>
                )}
                {s.critico > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />{s.critico}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterSetor} onValueChange={setFilterSetor}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Setores</SelectItem>
            {setores?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterGrupo} onValueChange={setFilterGrupo}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Grupo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Grupos</SelectItem>
            {grupos.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="alerta">Alerta</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Custo Unit.</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {setorItems?.length === 0 ? "Nenhum item vinculado a setores nesta unidade." : "Nenhum item encontrado com os filtros aplicados."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.items_catalog?.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{item.items_catalog?.code}</TableCell>
                    <TableCell className="text-xs">{item.items_catalog?.grupo || "—"}</TableCell>
                    <TableCell className="text-xs">{item.setores?.nome}</TableCell>
                    <TableCell className="text-right font-mono">{item.saldo}</TableCell>
                    <TableCell className="text-right font-mono">{item.estoque_minimo}</TableCell>
                    <TableCell className="text-right font-mono text-xs">R$ {item.custo.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">R$ {item.valorTotal.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "ok" ? "default" : item.status === "alerta" ? "outline" : "destructive"}
                        className={item.status === "ok" ? "bg-green-600" : item.status === "alerta" ? "text-yellow-600 border-yellow-400" : ""}>
                        {item.status === "ok" ? "OK" : item.status === "alerta" ? "Alerta" : "Crítico"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
