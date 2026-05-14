import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "highlight" | "flat";

export interface CJGlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  children: ReactNode;
}

/**
 * Apple-minimal card primitive.
 * - dark: backdrop-blur over translucent surface
 * - light: opaque surface, sutil shadow
 */
export const CJGlassCard = forwardRef<HTMLDivElement, CJGlassCardProps>(
  ({ variant = "default", className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "cj-card",
          variant === "highlight" && "cj-card-highlight",
          variant === "flat" && "cj-card-flat",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
CJGlassCard.displayName = "CJGlassCard";

export default CJGlassCard;
