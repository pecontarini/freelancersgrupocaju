import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FitTextProps {
  children: React.ReactNode;
  /** Tamanho máximo de fonte em px. */
  max?: number;
  /** Tamanho mínimo de fonte em px. */
  min?: number;
  className?: string;
}

/**
 * Reduz dinamicamente o tamanho da fonte para que o conteúdo caiba
 * na largura do container pai, sem quebrar linha.
 */
export function FitText({
  children,
  max = 30,
  min = 12,
  className,
  as: Tag = "span",
}: FitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const fit = () => {
      // reset para medir natural
      el.style.fontSize = `${max}px`;
      const available = parent.clientWidth;
      if (available <= 0) return;
      const scrollW = el.scrollWidth;
      if (scrollW <= available) {
        setSize(max);
        return;
      }
      const ratio = available / scrollW;
      const next = Math.max(min, Math.floor(max * ratio));
      setSize(next);
      el.style.fontSize = `${next}px`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [children, max, min]);

  return (
    <Tag
      ref={ref as never}
      className={cn("inline-block whitespace-nowrap leading-none", className)}
      style={{ fontSize: `${size}px` }}
    >
      {children}
    </Tag>
  );
}
