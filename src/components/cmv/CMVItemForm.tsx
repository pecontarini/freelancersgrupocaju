import { useState } from "react";
import { Plus, Edit2, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCMVItems, CMVItem } from "@/hooks/useCMV";
import { formatCurrency } from "@/lib/formatters";

export function CMVItemForm() {
  const { items, isLoading, addItem, updateItem, deleteItem } = useCMVItems();
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CMVItem | null>(null);
  
  // Form state
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("kg");
  const [pesoPadraoG, setPesoPadraoG] = useState("");
  const [precoCusto, setPrecoCusto] = useState("");
  const [categoria, setCategoria] = useState("carne");

  const resetForm = () => {
    setNome("");
    setUnidade("kg");
    setPesoPadraoG("");
    setPrecoCusto("");
    setCategoria("carne");
    setEditingItem(null);
  };

  const handleOpen = (item?: CMVItem) => {
    if (item) {
      setEditingItem(item);
      setNome(item.nome);
      setUnidade(item.unidade);
      setPesoPadraoG(item.peso_padrao_g?.toString() || "");
      setPrecoCusto(item.preco_custo_atual.toString());
      setCategoria(item.categoria || "carne");
    } else {
      resetForm();
    }
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    if (!nome.trim()) return;

    const itemData = {
      nome: nome.trim(),
      unidade,
      peso_padrao_g: pesoPadraoG ? parseFloat(pesoPadraoG) : null,
      preco_custo_atual: precoCusto ? parseFloat(precoCusto) : 0,
      categoria,
      ativo: true,
    };

    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, ...itemData });
    } else {
      await addItem.mutateAsync(itemData);
    }
    
    setIsOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja remover este item?")) {
      await deleteItem.mutateAsync(id);
    }
  };

  const activeItems = items.filter(i => i.ativo);

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold uppercase">
              Cadastro de Itens
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Gerencie os itens de carne do estoque
            </p>
          </div>
        </div>
        <Button onClick={() => handleOpen()} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Item
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : activeItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum item cadastrado</p>
            <p className="text-sm">Clique em "Novo Item" para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Peso Padrão</TableHead>
                  <TableHead>Preço de Custo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.unidade}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.peso_padrao_g ? `${item.peso_padrao_g}g` : "-"}
                    </TableCell>
                    <TableCell>{formatCurrency(item.preco_custo_atual)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpen(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Item" : "Novo Item de Estoque"}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? "Atualize as informações do item de carne"
                : "Cadastre um novo item de carne para controle de CMV"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Item *</Label>
              <Input
                id="nome"
                placeholder="Ex: Picanha 250g"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unidade">Unidade</Label>
                <Select value={unidade} onValueChange={setUnidade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Quilograma (kg)</SelectItem>
                    <SelectItem value="g">Grama (g)</SelectItem>
                    <SelectItem value="un">Unidade (un)</SelectItem>
                    <SelectItem value="porcao">Porção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carne">Carne Bovina</SelectItem>
                    <SelectItem value="suino">Suíno</SelectItem>
                    <SelectItem value="frango">Frango</SelectItem>
                    <SelectItem value="cordeiro">Cordeiro</SelectItem>
                    <SelectItem value="peixe">Peixe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="peso">Peso Padrão (g)</Label>
                <Input
                  id="peso"
                  type="number"
                  placeholder="Ex: 250"
                  value={pesoPadraoG}
                  onChange={(e) => setPesoPadraoG(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preco">Preço de Custo (R$)</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 89.90"
                  value={precoCusto}
                  onChange={(e) => setPrecoCusto(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!nome.trim() || addItem.isPending || updateItem.isPending}
            >
              {editingItem ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
