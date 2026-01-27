import { useMemo } from "react";
import { 
  UtensilsCrossed, 
  Wine, 
  Users, 
  Truck, 
  Package, 
  Bath,
  AlertCircle,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSupervisionAudits, type SupervisionFailure } from "@/hooks/useSupervisionAudits";

interface ComplianceHeatmapProps {
  lojaId: string | null;
}

// Sector configuration with icons and keywords for matching
const SECTORS = [
  { 
    id: "cozinha", 
    name: "Cozinha", 
    icon: UtensilsCrossed,
    keywords: ["cozinha", "preparo", "manipulação", "alimento", "cocção", "fritadeira", "forno", "fogão"]
  },
  { 
    id: "bar", 
    name: "Bar", 
    icon: Wine,
    keywords: ["bar", "bebida", "drink", "coquetel", "refrigerador", "gelo"]
  },
  { 
    id: "salao", 
    name: "Salão", 
    icon: Users,
    keywords: ["salão", "atendimento", "mesa", "cadeira", "cardápio", "cliente", "recepção"]
  },
  { 
    id: "delivery", 
    name: "Delivery", 
    icon: Truck,
    keywords: ["delivery", "entrega", "embalagem", "motoboy", "pedido", "ifood", "rappi"]
  },
  { 
    id: "estoque", 
    name: "Estoque", 
    icon: Package,
    keywords: ["estoque", "armazenamento", "câmara", "freezer", "despensa", "validade", "fifo"]
  },
  { 
    id: "banheiro", 
    name: "Banheiros", 
    icon: Bath,
    keywords: ["banheiro", "sanitário", "higiene", "limpeza", "vestiário", "lavabo"]
  },
];

function categorizeSector(itemName: string): string {
  const lowerName = itemName.toLowerCase();
  
  for (const sector of SECTORS) {
    if (sector.keywords.some(keyword => lowerName.includes(keyword))) {
      return sector.id;
    }
  }
  
  // Default to "salao" if no match found
  return "geral";
}

export function ComplianceHeatmap({ lojaId }: ComplianceHeatmapProps) {
  const { failures, audits } = useSupervisionAudits(lojaId);

  // Calculate compliance by sector
  const sectorCompliance = useMemo(() => {
    // Get recent failures (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentFailures = failures.filter(f => {
      const failureDate = new Date(f.created_at);
      return failureDate >= thirtyDaysAgo;
    });

    // Group failures by sector
    const failuresBySector: Record<string, SupervisionFailure[]> = {};
    
    recentFailures.forEach(failure => {
      const sector = categorizeSector(failure.item_name);
      if (!failuresBySector[sector]) {
        failuresBySector[sector] = [];
      }
      failuresBySector[sector].push(failure);
    });

    // Calculate compliance score for each sector
    // Assuming each sector has ~20 checkpoints, calculate based on failures
    const sectorData = SECTORS.map(sector => {
      const sectorFailures = failuresBySector[sector.id] || [];
      const pendingCount = sectorFailures.filter(f => f.status === "pending").length;
      const resolvedCount = sectorFailures.filter(f => f.status !== "pending").length;
      const totalFailures = sectorFailures.length;
      
      // Estimate compliance (higher failures = lower compliance)
      // Max 5 failures = 0%, 0 failures = 100%
      const complianceScore = Math.max(0, 100 - (pendingCount * 15));
      
      return {
        ...sector,
        failures: sectorFailures,
        pendingCount,
        resolvedCount,
        totalFailures,
        complianceScore,
      };
    });

    return sectorData;
  }, [failures]);

  // Get color class based on compliance
  const getComplianceColor = (score: number) => {
    if (score >= 95) return { bg: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-500" };
    if (score >= 80) return { bg: "bg-amber-500", text: "text-amber-700", border: "border-amber-500" };
    return { bg: "bg-destructive", text: "text-destructive", border: "border-destructive" };
  };

  // Get status icon
  const getStatusIcon = (score: number) => {
    if (score >= 95) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (score >= 80) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />;
  };

  // Latest audit score
  const latestAudit = audits[0];

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base uppercase">
          <Package className="h-5 w-5 text-primary" />
          Mapa de Conformidade
        </CardTitle>
        <CardDescription>
          Visão por setores baseada nas auditorias de supervisão
          {latestAudit && (
            <Badge variant="outline" className="ml-2">
              Última auditoria: {latestAudit.global_score.toFixed(0)}%
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {!lojaId ? (
          <div className="text-center py-8 text-muted-foreground">
            Selecione uma unidade para visualizar o mapa de conformidade.
          </div>
        ) : (
          <TooltipProvider>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {sectorCompliance.map((sector) => {
                const colors = getComplianceColor(sector.complianceScore);
                const Icon = sector.icon;

                return (
                  <Tooltip key={sector.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "relative rounded-2xl p-4 border-2 transition-all duration-300 cursor-pointer hover:scale-105",
                          colors.border,
                          sector.complianceScore < 80 && "animate-pulse"
                        )}
                      >
                        {/* Background gradient based on compliance */}
                        <div 
                          className={cn(
                            "absolute inset-0 rounded-2xl opacity-10",
                            colors.bg
                          )}
                        />
                        
                        <div className="relative z-10 flex flex-col items-center text-center space-y-2">
                          <div className={cn(
                            "p-3 rounded-xl",
                            sector.complianceScore >= 95 ? "bg-emerald-500/20" :
                            sector.complianceScore >= 80 ? "bg-amber-500/20" :
                            "bg-destructive/20"
                          )}>
                            <Icon className={cn("h-6 w-6", colors.text)} />
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium uppercase">{sector.name}</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              {getStatusIcon(sector.complianceScore)}
                              <span className={cn("text-lg font-bold", colors.text)}>
                                {sector.complianceScore}%
                              </span>
                            </div>
                          </div>

                          {sector.pendingCount > 0 && (
                            <Badge 
                              variant="destructive" 
                              className="text-xs"
                            >
                              {sector.pendingCount} pendência{sector.pendingCount > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-medium">{sector.name}</p>
                        <div className="text-sm text-muted-foreground">
                          <p>Pendências: {sector.pendingCount}</p>
                          <p>Resolvidas: {sector.resolvedCount}</p>
                        </div>
                        {sector.failures.length > 0 && (
                          <div className="text-xs border-t pt-2 mt-2">
                            <p className="font-medium mb-1">Itens recentes:</p>
                            <ul className="list-disc list-inside">
                              {sector.failures.slice(0, 3).map(f => (
                                <li key={f.id} className="truncate">
                                  {f.item_name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">≥95% Conforme</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-muted-foreground">80-94% Atenção</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-muted-foreground">&lt;80% Crítico</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
