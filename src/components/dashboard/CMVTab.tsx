import { Package, BarChart3, TrendingDown, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CMVTab() {
  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Package className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold uppercase">
            CMV (Unitários)
          </h2>
          <p className="text-muted-foreground">
            Controle de insumos e estoque
          </p>
        </div>
      </div>

      {/* Placeholder Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl shadow-card border-dashed border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              CMV Realizado
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">---%</div>
            <p className="text-xs text-muted-foreground">Em desenvolvimento</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card border-dashed border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Meta CMV
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">---%</div>
            <p className="text-xs text-muted-foreground">Em desenvolvimento</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card border-dashed border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Alertas de Estoque
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">---</div>
            <p className="text-xs text-muted-foreground">Em desenvolvimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon Section */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-bold uppercase mb-2">
            Módulo em Desenvolvimento
          </h3>
          <p className="text-muted-foreground max-w-md">
            O controle de CMV (Custo de Mercadorias Vendidas) está sendo
            desenvolvido para oferecer rastreamento detalhado de insumos,
            gestão de estoque e análise de custos unitários.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-muted-foreground">📦</p>
              <p className="text-xs text-muted-foreground mt-2 uppercase">
                Gestão de Insumos
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-muted-foreground">📊</p>
              <p className="text-xs text-muted-foreground mt-2 uppercase">
                Análise de Custos
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-muted-foreground">🔔</p>
              <p className="text-xs text-muted-foreground mt-2 uppercase">
                Alertas Inteligentes
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-muted-foreground">📈</p>
              <p className="text-xs text-muted-foreground mt-2 uppercase">
                Projeções
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
