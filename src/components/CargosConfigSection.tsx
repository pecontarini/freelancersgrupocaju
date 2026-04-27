import { useState } from "react";
import {
  Settings,
  Users,
  Loader2,
  ChefHat,
  Briefcase,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useCargos,
  useMetasCargo,
  META_LABELS,
  ORIGEM_LABELS,
  SETOR_BACK_LABELS,
  TIER_CONFIG,
  type Cargo,
  type OrigemDado,
} from "@/hooks/useCargos";
import { formatCurrency } from "@/lib/formatters";
import { AddMetaDialog } from "./cargos/AddMetaDialog";

export function CargosConfigSection() {
  const { cargos, gerencias, chefiasBack, chefiasFront, isLoading: isLoadingCargos, updateCargo } = useCargos();
  const {
    metas,
    isLoading: isLoadingMetas,
    updateMeta,
    createMeta,
    deleteMeta,
    getMetasByCargo,
  } = useMetasCargo(undefined, { includeInactive: true });

  const [editingCargo, setEditingCargo] = useState<string | null>(null);
  const [editingTeto, setEditingTeto] = useState<string | null>(null);
  const [editingPeso, setEditingPeso] = useState<string | null>(null);

  const isLoading = isLoadingCargos || isLoadingMetas;

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const handlePoteUpdate = (cargoId: string, value: string) => {
    const numValue = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!isNaN(numValue) && numValue > 0) {
      updateCargo.mutate({ id: cargoId, pote_variavel_max: numValue });
      setEditingCargo(null);
    }
  };

  const handleTetoUpdate = (metaId: string, value: string) => {
    const numValue = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!isNaN(numValue) && numValue >= 0) {
      updateMeta.mutate({ id: metaId, teto_valor: numValue });
      setEditingTeto(null);
    }
  };

  const handlePesoUpdate = (metaId: string, value: string) => {
    const numValue = parseFloat(value.replace(",", "."));
    if (!isNaN(numValue) && numValue >= 0) {
      updateMeta.mutate({ id: metaId, peso: numValue });
      setEditingPeso(null);
    }
  };

  const CargoCard = ({ cargo }: { cargo: Cargo }) => {
    const cargoMetas = getMetasByCargo(cargo.id);
    const totalTetoAtivo = cargoMetas
      .filter((m) => m.ativo)
      .reduce((sum, m) => sum + m.teto_valor, 0);

    return (
      <AccordionItem value={cargo.id} className="border rounded-lg px-4 mb-2">
        <AccordionTrigger className="hover:no-underline py-3">
          <div className="flex items-center gap-3 w-full">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              {cargo.categoria === "gerencia" ? (
                <Briefcase className="h-5 w-5 text-primary" />
              ) : cargo.setor_back ? (
                <ChefHat className="h-5 w-5 text-primary" />
              ) : (
                <Users className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium">{cargo.nome}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs">
                  {cargo.categoria === "gerencia" ? "Gerência" : "Chefia"}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {cargo.familia_operacional === "front" ? "Front" : "Back"}
                </Badge>
                {cargo.setor_back && (
                  <Badge className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-100">
                    {SETOR_BACK_LABELS[cargo.setor_back]}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right mr-4">
              <p className="text-xs text-muted-foreground">Teto Variável</p>
              <p className="font-bold text-primary">{formatCurrency(cargo.pote_variavel_max)}</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <div className="space-y-4">
            {/* Pote Variável Edit */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Pote Variável Máximo (100%)</p>
                <p className="text-xs text-muted-foreground">
                  Valor máximo de bônus ao atingir Ouro em todas as metas
                </p>
              </div>
              {editingCargo === cargo.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    defaultValue={cargo.pote_variavel_max}
                    className="w-32 text-right"
                    onBlur={(e) => handlePoteUpdate(cargo.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handlePoteUpdate(cargo.id, e.currentTarget.value);
                      }
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditingCargo(cargo.id)}>
                  {formatCurrency(cargo.pote_variavel_max)}
                </Button>
              )}
            </div>

            {/* Header com botão de adicionar variável */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Variáveis de Bônus</h4>
              <AddMetaDialog
                cargoId={cargo.id}
                cargoNome={cargo.nome}
                existingMetas={cargoMetas}
                onCreate={(params) => createMeta.mutateAsync(params)}
                isPending={createMeta.isPending}
              />
            </div>

            {/* Metas Table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meta</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-20">Peso</TableHead>
                    <TableHead className="text-right">Teto (R$)</TableHead>
                    <TableHead className="w-24 text-center">Ativa</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargoMetas.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-xs text-muted-foreground py-4"
                      >
                        Nenhuma variável configurada. Clique em "Adicionar Variável" acima.
                      </TableCell>
                    </TableRow>
                  )}
                  {cargoMetas.map((meta) => (
                    <TableRow
                      key={meta.id}
                      className={!meta.ativo ? "opacity-50" : ""}
                    >
                      <TableCell className="font-medium">
                        {META_LABELS[meta.codigo_meta]}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={meta.origem_dado}
                          onValueChange={(v) =>
                            updateMeta.mutate({
                              id: meta.id,
                              origem_dado: v as OrigemDado,
                            })
                          }
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(ORIGEM_LABELS) as OrigemDado[]).map((k) => (
                              <SelectItem key={k} value={k} className="text-xs">
                                {ORIGEM_LABELS[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {editingPeso === meta.id ? (
                          <Input
                            type="text"
                            inputMode="decimal"
                            defaultValue={meta.peso}
                            className="h-7 w-16 text-xs"
                            onBlur={(e) => handlePesoUpdate(meta.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handlePesoUpdate(meta.id, e.currentTarget.value);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-16 text-xs"
                            onClick={() => setEditingPeso(meta.id)}
                          >
                            {meta.peso}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingTeto === meta.id ? (
                          <Input
                            type="text"
                            defaultValue={meta.teto_valor}
                            className="w-24 text-right ml-auto"
                            onBlur={(e) => handleTetoUpdate(meta.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleTetoUpdate(meta.id, e.currentTarget.value);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setEditingTeto(meta.id)}
                          >
                            {formatCurrency(meta.teto_valor)}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={meta.ativo}
                          onCheckedChange={(checked) =>
                            updateMeta.mutate({ id: meta.id, ativo: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title="Remover variável"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover variável?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover a variável{" "}
                                <strong>{META_LABELS[meta.codigo_meta]}</strong> do cargo{" "}
                                <strong>{cargo.nome}</strong>? Essa ação não pode ser desfeita.
                                Se preferir apenas pausar o cálculo, use o switch "Ativa".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMeta.mutate(meta.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5">
              <span className="text-sm font-medium">
                Total das Metas Ativas
                {cargoMetas.some((m) => !m.ativo) && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({cargoMetas.filter((m) => !m.ativo).length} inativa(s) ignorada(s))
                  </span>
                )}
              </span>
              <span className="font-bold text-primary">{formatCurrency(totalTetoAtivo)}</span>
            </div>

            {/* Tier Breakdown */}
            <div className="grid grid-cols-4 gap-2">
              {(["ouro", "prata", "bronze", "aceitavel"] as const).map((tier) => {
                const config = TIER_CONFIG[tier];
                const isGerente = cargo.categoria === "gerencia";
                const percentage =
                  tier === "ouro"
                    ? 100
                    : tier === "prata"
                      ? isGerente
                        ? 75
                        : 66.6
                      : tier === "bronze"
                        ? isGerente
                          ? 50
                          : 33.3
                        : isGerente
                          ? 25
                          : 0;
                const value = (cargo.pote_variavel_max * percentage) / 100;

                return (
                  <div
                    key={tier}
                    className={`p-2 rounded-lg text-center bg-gradient-to-br ${config.gradient} text-white`}
                  >
                    <p className="text-xs font-medium opacity-80">{config.label}</p>
                    <p className="text-sm font-bold">{formatCurrency(value)}</p>
                    <p className="text-xs opacity-70">≥{config.minPercent}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle className="text-base uppercase">Central de Regras - Cargos V2</CardTitle>
        </div>
        <CardDescription>
          Configure os cargos oficiais, variáveis de bônus (teto, peso, origem) e ative/desative
          metas individualmente.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="gerencia" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gerencia" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Gerência
            </TabsTrigger>
            <TabsTrigger value="chefia-front" className="gap-2">
              <Users className="h-4 w-4" />
              Chefia Front
            </TabsTrigger>
            <TabsTrigger value="chefia-back" className="gap-2">
              <ChefHat className="h-4 w-4" />
              Chefia Back
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gerencia" className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Cargos de gerência. Adicione, edite ou desative variáveis de bônus.
            </p>
            <Accordion type="single" collapsible>
              {gerencias.map((cargo) => (
                <CargoCard key={cargo.id} cargo={cargo} />
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="chefia-front" className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Chefias de Salão e APV. Adicione, edite ou desative variáveis de bônus.
            </p>
            <Accordion type="single" collapsible>
              {chefiasFront.map((cargo) => (
                <CargoCard key={cargo.id} cargo={cargo} />
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="chefia-back" className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Chefias específicas por setor (Cozinha, Bar, Parrilla, Sushi). Inclui Tempo de
              Comanda quando ativada.
            </p>
            <Accordion type="single" collapsible>
              {chefiasBack.map((cargo) => (
                <CargoCard key={cargo.id} cargo={cargo} />
              ))}
            </Accordion>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
