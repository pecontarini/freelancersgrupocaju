import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  ListChecks,
  TrendingUp,
  AlertTriangle,
  ClipboardCheck,
  Building2,
  Timer,
  Fish,
  Beef,
  Trophy,
  Radar,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { META_DEFINITIONS, META_GROUPS } from "./metas";
import type { MetaKey } from "./types";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  MessageSquare,
  ListChecks,
  TrendingUp,
  AlertTriangle,
  ClipboardCheck,
  Building2,
  Timer,
  Fish,
  Beef,
  Trophy,
  Radar,
};

interface PainelSidebarProps {
  active: MetaKey;
  onSelect: (key: MetaKey) => void;
  showAdmin: boolean;
  /** Visível para admin/operator/gerente_unidade. */
  showManagerPlus?: boolean;
  /** Map de meta -> badge (ex.: red flags ativas). */
  badges?: Partial<Record<MetaKey, number>>;
  /** Força sidebar expandida (ex.: dentro de um sheet mobile). */
  forceExpanded?: boolean;
}

/**
 * Vision-Pro inspired meta sidebar (rail).
 * Default state: rail estreito mostrando APENAS ícones circulares de vidro líquido.
 * Ao clicar no botão de toggle (chevron), expande revelando os labels com animação suave.
 * Inspirado na sidebar esquerda do Apple Vision Pro Smart Home dashboard.
 */
export function PainelSidebar({
  active,
  onSelect,
  showAdmin,
  showManagerPlus = false,
  badges,
  forceExpanded = false,
}: PainelSidebarProps) {
  const [expanded, setExpanded] = useState(forceExpanded);
  const isExpanded = forceExpanded || expanded;

  const groups = useMemo(
    () =>
      META_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((k) => {
          const def = META_DEFINITIONS[k];
          if (def.adminOnly) return showAdmin;
          if (def.managerPlus) return showManagerPlus;
          return true;
        }),
      })).filter((g) => g.items.length > 0),
    [showAdmin, showManagerPlus]
  );

  return (
    <nav
      aria-label="Indicadores"
      data-expanded={isExpanded}
      className={cn(
        "vision-glass relative flex flex-col gap-2 p-2",
        "transition-[width] duration-500 ease-[cubic-bezier(0.65,0,0.35,1)]",
        isExpanded ? "w-[224px]" : "w-[64px]"
      )}
    >
      {/* Toggle */}
      {!forceExpanded && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={isExpanded ? "Recolher menu" : "Expandir menu"}
          aria-expanded={isExpanded}
          className={cn(
            "vision-glass-icon group/toggle absolute top-2 z-10 flex h-7 w-7 items-center justify-center",
            "transition-all duration-500 ease-[cubic-bezier(0.65,0,0.35,1)]",
            isExpanded ? "right-2" : "right-1/2 translate-x-1/2"
          )}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-foreground/70 transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)]",
              isExpanded && "rotate-180"
            )}
            strokeWidth={2.4}
          />
        </button>
      )}

      <div className={cn("flex flex-col gap-3", !forceExpanded && "mt-10")}>
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            {/* Group label — visível apenas quando expandido */}
            <div
              className={cn(
                "overflow-hidden px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80",
                "transition-all duration-300 ease-out",
                isExpanded ? "max-h-6 opacity-100 pb-1" : "max-h-0 opacity-0"
              )}
            >
              {group.title}
            </div>

            <ul className="flex flex-col gap-1.5">
              {group.items.map((key) => {
                const def = META_DEFINITIONS[key];
                const Icon = ICONS[def.iconKey] ?? LayoutDashboard;
                const isActive = active === key;
                const badge = badges?.[key];

                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isExpanded && !forceExpanded) {
                          // Primeiro clique no rail recolhido: expande E seleciona
                          setExpanded(true);
                        }
                        onSelect(key);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      title={def.label}
                      className={cn(
                        "group relative flex w-full items-center rounded-2xl text-left",
                        "transition-all duration-300 ease-[cubic-bezier(0.65,0,0.35,1)]",
                        isExpanded ? "gap-3 px-1.5 py-1.5" : "justify-center p-1",
                        "hover:bg-foreground/[0.04] dark:hover:bg-foreground/[0.04]",
                        isActive && "bg-white/50 dark:bg-foreground/[0.06]"
                      )}
                    >
                      {/* Circular glass icon */}
                      <span
                        data-active={isActive}
                        className="vision-glass-icon relative flex h-11 w-11 shrink-0 items-center justify-center"
                      >
                        <Icon
                          className={cn(
                            "h-[19px] w-[19px] transition-colors",
                            isActive
                              ? "text-primary"
                              : "text-foreground/70 group-hover:text-foreground"
                          )}
                          strokeWidth={2.2}
                        />
                        {badge && badge > 0 ? (
                          <span
                            aria-label={`${badge} alerta${badge > 1 ? "s" : ""}`}
                            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground ring-2 ring-background"
                          >
                            {badge}
                          </span>
                        ) : null}
                      </span>

                      {/* Label — anima ao expandir */}
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide transition-all duration-300 ease-out",
                          isExpanded
                            ? "max-w-[160px] opacity-100"
                            : "max-w-0 opacity-0 -translate-x-1",
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      >
                        {def.label}
                      </span>

                      {/* Indicador ativo no rail recolhido */}
                      {!isExpanded && isActive && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -left-2 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
