import { Sparkles, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkerType = "freelancer" | "clt";

interface Props {
  value: WorkerType;
  onChange: (value: WorkerType) => void;
  disabled?: boolean;
}

export function WorkerTypeSegmented({ value, onChange, disabled }: Props) {
  const options: { id: WorkerType; label: string; icon: any }[] = [
    { id: "freelancer", label: "Freelancer", icon: Sparkles },
    { id: "clt", label: "CLT (urgência)", icon: ShieldAlert },
  ];

  return (
    <div
      role="tablist"
      className="inline-flex w-full items-center gap-1 rounded-xl border border-border/50 bg-muted/40 p-1"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:opacity-50 disabled:pointer-events-none",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
