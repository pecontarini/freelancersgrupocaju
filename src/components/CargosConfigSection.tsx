import { useState } from "react";
import {
  Settings,
  Users,
  Target,
  Award,
  Loader2,
  Save,
  ChefHat,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  useCargos, 
  useMetasCargo, 
  META_LABELS,
  SETOR_BACK_LABELS,
  TIER_CONFIG,
  type Cargo,
} from "@/hooks/useCargos";
import { formatCurrency } from "@/lib/formatters";

export function CargosConfigSection() {
  const { cargos, gerencias, chefias, chefiasBack, chefiasFront, isLoading: isLoadingCargos, updateCargo } = useCargos();
  const { metas, isLoading: isLoadingMetas, updateMeta, getMetasByCargo } = useMetasCargo();

  const [editingCargo, setEditingCargo] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<string | null>(null);

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
    if (!isNaN(numValue) && numValue > 0) {
      updateMeta.mutate({ id: metaId, teto_valor: numValue });
      setEditingMeta(null);
    }
  };

  const CargoCard = ({ cargo }: { cargo: Cargo }) => {
    const cargoMetas = getMetasByCargo(cargo.id);
    const totalTeto = cargoMetas.reduce((sum, m) => sum + m.teto_valor, 0);

    return (
      <AccordionItem value={cargo.id} className="border rounded-lg px-4 mb-2">
        <AccordionTrigger className="hover:no-underline py-3">
          <div className="flex items-center gap-3 w-full">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              {cargo.categoria === 'gerencia' ? (
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
                  {cargo.categoria === 'gerencia' ? 'Gerência' : 'Chefia'}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {cargo.familia_operacional === 'front' ? 'Front' : 'Back'}
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
                      if (e.key === 'Enter') {
                        handlePoteUpdate(cargo.id, e.currentTarget.value);
                      }
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingCargo(cargo.id)}
                >
                  {formatCurrency(cargo.pote_variavel_max)}
                </Button>
              )}
            </div>

            {/* Metas Table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meta</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead className="text-right">Teto (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargoMetas.map((meta) => (
                    <TableRow key={meta.id}>
                      <TableCell className="font-medium">
                        {META_LABELS[meta.codigo_meta]}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {meta.origem_dado.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{meta.peso}</TableCell>
                      <TableCell className="text-right">
                        {editingMeta === meta.id ? (
                          <Input
                            type="text"
                            defaultValue={meta.teto_valor}
                            className="w-24 text-right ml-auto"
                            onBlur={(e) => handleTetoUpdate(meta.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
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
                            onClick={() => setEditingMeta(meta.id)}
                          >
                            {formatCurrency(meta.teto_valor)}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5">
              <span className="text-sm font-medium">Total das Metas</span>
              <span className="font-bold text-primary">{formatCurrency(totalTeto)}</span>
            </div>

            {/* Tier Breakdown */}
            <div className="grid grid-cols-4 gap-2">
              {(['ouro', 'prata', 'bronze', 'aceitavel'] as const).map((tier) => {
                const config = TIER_CONFIG[tier];
                const isGerente = cargo.categoria === 'gerencia';
                const percentage = tier === 'ouro' ? 100 
                  : tier === 'prata' ? (isGerente ? 75 : 66.6)
                  : tier === 'bronze' ? (isGerente ? 50 : 33.3)
                  : (isGerente ? 25 : 0);
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
          Configure os cargos oficiais, metas e valores de remuneração variável.
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
              Cargos de gerência com teto de R$ 5.000,00 e 3 metas: NPS Salão, NPS Delivery e Supervisão.
            </p>
            <Accordion type="single" collapsible>
              {gerencias.map((cargo) => (
                <CargoCard key={cargo.id} cargo={cargo} />
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="chefia-front" className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Chefias de Salão e APV com teto de R$ 3.000,00 e 2 metas: NPS e Supervisão.
            </p>
            <Accordion type="single" collapsible>
              {chefiasFront.map((cargo) => (
                <CargoCard key={cargo.id} cargo={cargo} />
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="chefia-back" className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Chefias específicas por setor (Cozinha, Bar, Parrilla, Sushi) com teto de R$ 3.000,00.
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
