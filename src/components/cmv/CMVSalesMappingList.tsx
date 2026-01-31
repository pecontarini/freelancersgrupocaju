import { Link2, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCMVSalesMappings } from "@/hooks/useCMV";

export function CMVSalesMappingList() {
  const { mappings, isLoading, deleteMapping } = useCMVSalesMappings();

  const handleDelete = async (id: string) => {
    if (confirm("Remover este mapeamento? O sistema pedirá novamente quando encontrar este item.")) {
      await deleteMapping.mutateAsync(id);
    }
  };

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
            <Link2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold uppercase">
              Mapeamentos de Vendas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Vínculos automáticos: Item de Venda → Item de Estoque
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum mapeamento configurado</p>
            <p className="text-sm">
              Os mapeamentos serão criados automaticamente ao processar relatórios de vendas
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome no Relatório</TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Item de Estoque</TableHead>
                  <TableHead>Multiplicador</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {mapping.nome_venda}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-medium">
                      {mapping.cmv_item?.nome || "-"}
                      {mapping.cmv_item?.peso_padrao_g && (
                        <span className="text-muted-foreground ml-2">
                          ({mapping.cmv_item.peso_padrao_g}g)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={mapping.multiplicador !== 1 ? "default" : "secondary"}
                      >
                        {mapping.multiplicador}x
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                      {mapping.notas || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(mapping.id)}
                        disabled={deleteMapping.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
