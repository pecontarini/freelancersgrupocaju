import { useEffect, useRef } from "react";

/**
 * Cajupar fundo gradient + 3 blobs animados (drift senoidal).
 * Renderizado APENAS dentro do scope `.cj-scope`. Não vaza pro resto do app.
 */
export function PayoutBackground() {
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const dt = (t - start) / 1000;
      const a = Math.sin(dt * 0.6) * 22;
      const b = Math.cos(dt * 0.5) * 18;
      const c = Math.sin(dt * 0.4 + 1.2) * 25;
      if (ref1.current) ref1.current.style.transform = `translate3d(${a}px, ${b}px, 0)`;
      if (ref2.current) ref2.current.style.transform = `translate3d(${-b}px, ${c}px, 0)`;
      if (ref3.current) ref3.current.style.transform = `translate3d(${c * 0.6}px, ${a * 0.8}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="cj-bg-root" aria-hidden>
      <div ref={ref1} className="cj-blob cj-blob-1" />
      <div ref={ref2} className="cj-blob cj-blob-2" />
      <div ref={ref3} className="cj-blob cj-blob-3" />
    </div>
  );
}
