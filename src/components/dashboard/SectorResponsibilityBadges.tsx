import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { User, Users } from "lucide-react";
import { 
  SECTOR_POSITION_MAP,
  POSITION_LABELS,
  POSITION_COLORS,
  type AuditSector,
} from "@/lib/sectorPositionMapping";

interface SectorResponsibilityBadgesProps {
  sector: AuditSector;
  showVacant?: boolean;
  vacantPositions?: string[];
}

export function SectorResponsibilityBadges({ 
  sector,
  showVacant = false,
  vacantPositions = [],
}: SectorResponsibilityBadgesProps) {
  const config = SECTOR_POSITION_MAP[sector];
  
  if (!config) return null;

  const isChiefVacant = config.primaryChief && vacantPositions.includes(config.primaryChief);
  const isManagerVacant = vacantPositions.includes(config.responsibleManager);

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1">
        {/* Chief Badge */}
        {config.primaryChief && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-xs gap-1"
                style={{ 
                  borderColor: isChiefVacant ? 'hsl(var(--muted))' : POSITION_COLORS[config.primaryChief],
                  color: isChiefVacant ? 'hsl(var(--muted-foreground))' : POSITION_COLORS[config.primaryChief],
                  opacity: isChiefVacant ? 0.5 : 1,
                }}
              >
                <User className="h-3 w-3" />
                {POSITION_LABELS[config.primaryChief].replace('Chefe de ', '')}
                {isChiefVacant && showVacant && ' (Vago)'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {isChiefVacant 
                  ? `Cargo vago - Nota atribuída ao ${POSITION_LABELS[config.responsibleManager]}`
                  : `Responsável direto: ${POSITION_LABELS[config.primaryChief]}`
                }
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Manager Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="text-xs gap-1"
              style={{ 
                borderColor: POSITION_COLORS[config.responsibleManager],
                color: POSITION_COLORS[config.responsibleManager],
              }}
            >
              <Users className="h-3 w-3" />
              {POSITION_LABELS[config.responsibleManager].replace('Gerente de ', 'G.')}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Gerente responsável: {POSITION_LABELS[config.responsibleManager]}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// Compact version for lists
interface SectorBadgeCompactProps {
  sector: AuditSector;
}

export function SectorBadgeCompact({ sector }: SectorBadgeCompactProps) {
  const config = SECTOR_POSITION_MAP[sector];
  
  if (!config) return null;

  const primaryColor = config.primaryChief 
    ? POSITION_COLORS[config.primaryChief] 
    : POSITION_COLORS[config.responsibleManager];

  return (
    <Badge
      variant="secondary"
      className="text-xs"
      style={{ 
        backgroundColor: `${primaryColor}20`,
        color: primaryColor,
        borderColor: primaryColor,
      }}
    >
      {config.displayName}
    </Badge>
  );
}
