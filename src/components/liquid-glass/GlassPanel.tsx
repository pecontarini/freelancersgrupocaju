import React from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: "light" | "medium" | "strong";
  children: React.ReactNode;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, intensity = "medium", children, style, ...props }, ref) => {
    const bgMap = {
      light: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
      medium: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
      strong: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))",
    };

    return (
      <div
        ref={ref}
        className="relative overflow-hidden"
        style={{
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          background: bgMap[intensity],
          borderTop: "1px solid rgba(255,255,255,0.35)",
          borderLeft: "1px solid rgba(255,255,255,0.2)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)",
          borderRadius: 24,
          ...style,
        }}
        {...props}
      >
        {/* Specular highlight */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{
            height: "40%",
            background: "radial-gradient(ellipse at top center, rgba(255,255,255,0.18) 0%, transparent 60%)",
          }}
        />
        <div className={cn("relative z-10", className)}>{children}</div>
      </div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";
