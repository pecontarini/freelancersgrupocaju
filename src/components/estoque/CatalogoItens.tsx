import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useItemsCatalog, useSetores, useSetorItems, useCreateSetorItem, useUpdateSetorItem, useUpdateCatalogItemCost } from "@/hooks/useEstoque";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Search, Link2, Upload, Edit2, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function CatalogoItens() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: catalog, isLoading } = useItemsCatalog();
  const { data: setores } = useSetores();
  const { data: setorItems } = useSetorItems(effectiveUnidadeId);
  const createLink = useCreateSetorItem();
  const updateLink = useUpdateSetorItem();
  const updateCost = useUpdateCatalogItemCost();

  const [search, setSearch] = useState("");
  const [filterGrandeGrupo, setFilterGrandeGrupo] = useState("all");
  const [filterGrupo, setFilterGrupo] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterUtensilio, setFilterUtensilio] = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Link dialog state
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkItem, setLinkItem] = useState<any>(null);
  const [linkSetorId, setLinkSetorId] = useState("");
  const [linkMin, setLinkMin] = useState("0");
  const [linkMax, setLinkMax] = useState("");
  const [linkPonto, setLinkPonto] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editSetorItemId, setEditSetorItemId] = useState("");
  
  // Cost edit state
  const [costEditId, setCostEditId] = useState<string | null>(null);
  const [costEditValue, setCostEditValue] = useState("");

  const grandeGrupos = useMemo(() => {
    const s = new Set<string>();
    catalog?.forEach((c: any) => { if (c.grande_grupo) s.add(c.grande_grupo); });
    return Array.from(s).sort();
  }, [catalog]);

  const grupos = useMemo(() => {
    const s = new Set<string>();
    catalog?.forEach((c: any) => { if (c.grupo) s.add(c.grupo); });
    return Array.from(s).sort();
  }, [catalog]);

  const tipos = useMemo(() => {
    const s = new Set<string>();
    catalog?.forEach((c: any) => { if (c.item_type) s.add(c.item_type); });
    return Array.from(s).sort();
  }, [catalog]);

  const linkedMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    setorItems?.forEach((si: any) => {
      if (!map[si.catalog_item_id]) map[si.catalog_item_id] = [];
      map[si.catalog_item_id].push(si);
    });
    return map;
  }, [setorItems]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    setCurrentPage(1);
    return catalog.filter((c: any) => {
      if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) && !c.code?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGrandeGrupo !== "all" && c.grande_grupo !== filterGrandeGrupo) return false;
      if (filterGrupo !== "all" && c.grupo !== filterGrupo) return false;
      if (filterTipo !== "all" && c.item_type !== filterTipo) return false;
      if (filterUtensilio === "yes" && !c.is_utensilio) return false;
      if (filterUtensilio === "no" && c.is_utensilio) return false;
      return true;
    });
  }, [catalog, search, filterGrandeGrupo, filterGrupo, filterTipo, filterUtensilio]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  const openLinkDialog = (item: any) => {
    setLinkItem(item);
    setLinkSetorId("");
    setLinkMin("0");
    setLinkMax("");
    setLinkPonto("");
    setEditMode(false);
    setLinkOpen(true);
  };

  const openEditDialog = (item: any, setorItem: any) => {
    setLinkItem(item);
    setLinkSetorId(setorItem.setor_id);
    setLinkMin(String(setorItem.estoque_minimo));
    setLinkMax(setorItem.estoque_maximo != null ? String(setorItem.estoque_maximo) : "");
    setLinkPonto(setorItem.ponto_pedido != null ? String(setorItem.ponto_pedido) : "");
    setEditMode(true);
    setEditSetorItemId(setorItem.id);
    setLinkOpen(true);
  };

  const handleSaveLink = () => {
    if (!effectiveUnidadeId) return;
    if (editMode) {
      updateLink.mutate({
        id: editSetorItemId,
        estoque_minimo: parseInt(linkMin) || 0,
        estoque_maximo: linkMax ? parseInt(linkMax) : undefined,
        ponto_pedido: linkPonto ? parseInt(linkPonto) : undefined,
      }, { onSuccess: () => setLinkOpen(false) });
    } else {
      if (!linkSetorId || !linkItem) return;
      createLink.mutate({
        catalog_item_id: linkItem.id,
        setor_id: linkSetorId,
        loja_id: effectiveUnidadeId,
        estoque_minimo: parseInt(linkMin) || 0,
        estoque_maximo: linkMax ? parseInt(linkMax) : undefined,
        ponto_pedido: linkPonto ? parseInt(linkPonto) : undefined,
      }, { onSuccess: () => setLinkOpen(false) });
    }
  };

  if (!effectiveUnidadeId) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma unidade.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterGrandeGrupo} onValueChange={setFilterGrandeGrupo}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Grande Grupo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {grandeGrupos.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterGrupo} onValueChange={setFilterGrupo}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Grupo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {grupos.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUtensilio} onValueChange={setFilterUtensilio}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Utensílio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="yes">Sim</SelectItem>
            <SelectItem value="no">Não</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-3">
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 por página</SelectItem>
              <SelectItem value="50">50 por página</SelectItem>
              <SelectItem value="100">100 por página</SelectItem>
              <SelectItem value="250">250 por página</SelectItem>
              <SelectItem value="500">500 por página</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} itens encontrados</span>
        </div>
        <Button variant="outline" disabled title="Importação CSV (em breve)">
          <Upload className="h-4 w-4 mr-2" />CSV
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>UM</TableHead>
                  <TableHead className="text-right">Custo Unit.</TableHead>
                  <TableHead>Grande Grupo</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Setores Vinculados</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Setores Vinculados</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item: any) => {
                  const links = linkedMap[item.id] || [];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.code}</TableCell>
                      <TableCell className="font-medium">
                        {item.name}
                        {item.is_utensilio && <Badge variant="outline" className="ml-2 text-xs">Utensílio</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{item.unit || "—"}</TableCell>
                      <TableCell className="text-right">
                        {costEditId === item.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-24 text-right h-8"
                              value={costEditValue}
                              onChange={(e) => setCostEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateCost.mutate({ id: item.id, preco_custo: parseFloat(costEditValue) || 0 });
                                  setCostEditId(null);
                                } else if (e.key === "Escape") {
                                  setCostEditId(null);
                                }
                              }}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-primary font-mono text-xs"
                            onClick={() => { setCostEditId(item.id); setCostEditValue(String(item.preco_custo || 0)); }}
                          >
                            R$ {(item.preco_custo || 0).toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{item.grande_grupo || "—"}</TableCell>
                      <TableCell className="text-xs">{item.grupo || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {links.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : links.map((l: any) => (
                            <Badge key={l.id} variant="secondary" className="text-xs cursor-pointer" onClick={() => openEditDialog(item, l)}>
                              {setores?.find((s: any) => s.id === l.setor_id)?.nome || "?"} <Edit2 className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openLinkDialog(item)}>
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de {filtered.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                  </PaginationItem>
                  {pageNumbers.map((pg, i) =>
                    pg === "ellipsis" ? (
                      <PaginationItem key={`e${i}`}><PaginationEllipsis /></PaginationItem>
                    ) : (
                      <PaginationItem key={pg}>
                        <PaginationLink isActive={pg === currentPage} onClick={() => setCurrentPage(pg as number)} className="cursor-pointer">{pg}</PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link / Edit dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode ? "Editar Vínculo" : "Vincular a Setor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm font-medium">{linkItem?.name} <span className="text-muted-foreground">({linkItem?.code})</span></p>
            {!editMode && (
              <div>
                <Label>Setor</Label>
                <Select value={linkSetorId} onValueChange={setLinkSetorId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
                  <SelectContent>
                    {setores?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Estoque Mínimo</Label><Input type="number" value={linkMin} onChange={(e) => setLinkMin(e.target.value)} /></div>
              <div><Label>Estoque Máximo</Label><Input type="number" value={linkMax} onChange={(e) => setLinkMax(e.target.value)} placeholder="Opcional" /></div>
              <div><Label>Ponto de Pedido</Label><Input type="number" value={linkPonto} onChange={(e) => setLinkPonto(e.target.value)} placeholder="Opcional" /></div>
            </div>
            <Button onClick={handleSaveLink} disabled={(!editMode && !linkSetorId) || createLink.isPending || updateLink.isPending} className="w-full">
              {editMode ? "Atualizar" : "Vincular"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
