import { useMemo } from "react";
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
};

interface PainelSidebarProps {
  active: MetaKey;
  onSelect: (key: MetaKey) => void;
  showAdmin: boolean;
  /** Map de meta -> badge (ex.: red flags ativas). */
  badges?: Partial<Record<MetaKey, number>>;
}

/**
 * Vision-Pro inspired meta sidebar.
 * Each item is rendered as a circular liquid-glass icon (40×40) + label.
 * Active item glows in coral; collapsed/mobile-friendly via icon-first layout.
 */
export function PainelSidebar({ active, onSelect, showAdmin, badges }: PainelSidebarProps) {
  const groups = useMemo(
    () =>
      META_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((k) =>
          META_DEFINITIONS[k].adminOnly ? showAdmin : true
        ),
      })).filter((g) => g.items.length > 0),
    [showAdmin]
  );

  return (
    <nav
      aria-label="Indicadores"
      className="vision-glass flex flex-col gap-3 p-3"
    >
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1.5">
          <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
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
                    onClick={() => onSelect(key)}
                    aria-current={isActive ? "page" : undefined}
                    title={def.label}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-2xl px-1.5 py-1.5 text-left transition-all duration-200",
                      "hover:bg-white/40 dark:hover:bg-white/[0.04]",
                      isActive && "bg-white/50 dark:bg-white/[0.06]"
                    )}
                  >
                    {/* Circular glass icon */}
                    <span
                      data-active={isActive}
                      className="vision-glass-icon relative flex h-10 w-10 shrink-0 items-center justify-center"
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] transition-colors",
                          isActive ? "text-primary" : "text-foreground/70 group-hover:text-foreground"
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

                    {/* Label */}
                    <span
                      className={cn(
                        "flex-1 truncate text-[11px] font-semibold uppercase tracking-wide transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      {def.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
