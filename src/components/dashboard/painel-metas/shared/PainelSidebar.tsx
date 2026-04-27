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
      className="glass-card flex flex-col gap-1 rounded-xl p-2"
    >
      {groups.map((group) => (
        <div key={group.title} className="mb-1">
          <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            {group.title}
          </div>
          <ul className="flex flex-col gap-0.5">
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
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg border-l-[3px] border-transparent px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-all",
                      "hover:bg-primary/5 hover:text-foreground",
                      isActive
                        ? "border-l-primary bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn("h-2 w-2 shrink-0 rounded-full", def.dotToken)}
                    />
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        isActive ? "text-primary" : "text-muted-foreground/70",
                        "group-hover:scale-110"
                      )}
                    />
                    <span className="flex-1 truncate">{def.label}</span>
                    {badge && badge > 0 ? (
                      <span
                        aria-label={`${badge} alerta${badge > 1 ? "s" : ""}`}
                        className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-destructive-foreground"
                      >
                        {badge}
                      </span>
                    ) : null}
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
