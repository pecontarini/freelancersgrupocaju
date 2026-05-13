import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "highlight" | "warning";

export function GlassCard({
  variant = "default",
  className,
  children,
  hover = false,
  ...rest
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
  hover?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "cj-glass",
        hover && "cj-glass-hover",
        variant === "highlight" && "cj-glass-highlight",
        variant === "warning" && "cj-glass-warn",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
